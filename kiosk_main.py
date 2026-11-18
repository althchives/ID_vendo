import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time
import requests
import threading

# --- FIREBASE REST API CONFIG ---
FIREBASE_URL = "https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app"
SECRET = "NHDkRkQ0PYBfSnVKuyESK5gWfsu9ubluRKhXaehJ"

def update_firebase(data_path, data_dict):
    try:
        url = f"{FIREBASE_URL}/kiosk/{data_path}.json?auth={SECRET}"
        requests.patch(url, json=data_dict, timeout=5)
    except Exception as e:
        print(f"[FIREBASE ERROR] Sync error: {e}")

def get_kiosk_data():
    try:
        url = f"{FIREBASE_URL}/kiosk.json?auth={SECRET}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"[FIREBASE ERROR] Read error: {e}")
    return None

def reset_kiosk_firebase():
    """Resets the Firebase kiosk tree to a clean initial state on startup"""
    clean_data = {
        "state": "01-idle",
        "motion_detected": False,
        "active_cubby": 1,
        "commands": {"action": "none", "timestamp": 0}
    }
    try:
        url = f"{FIREBASE_URL}/kiosk.json?auth={SECRET}"
        requests.put(url, json=clean_data, timeout=5)
        print("[FIREBASE] Database successfully reset to clean state.")
    except Exception as e:
        print(f"[FIREBASE ERROR] Could not reset database: {e}")

# --- GPIO SETUP ---
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# --- PIN MAPPINGS ---
PIR_PIN = 17                               # PIR Motion Sensor on GPIO 17
IR_PINS = [4, 18, 14, 16, 21, 15]          # Cubbies 1 to 6 IR sensors
SERVO_PINS = [5, 6, 13, 19, 26, 20]        # Cubbies 1 to 6 Servos

# DC Motor Pins (Card Dispenser)
EN_A = 12
IN_1 = 27
IN_2 = 22

# Ultrasonic Sensor Pins (For detecting card drop)
TRIG_PIN = 23
ECHO_PIN = 24

# --- RFID TO CUBBY MAPPING ---
RFID_TO_CUBBY = {
    584192329369: 1,
    584182872247: 2,
    584195475145: 3,
    584186054775: 4,
    584187072384: 5,
    584183954977: 6
}

CUBBY_TO_RFID = {v: k for k, v in RFID_TO_CUBBY.items()}

GPIO.setup(PIR_PIN, GPIO.IN)
for pin in IR_PINS:
    GPIO.setup(pin, GPIO.IN)

GPIO.setup(EN_A, GPIO.OUT)
GPIO.setup(IN_1, GPIO.OUT)
GPIO.setup(IN_2, GPIO.OUT)

GPIO.setup(TRIG_PIN, GPIO.OUT)
GPIO.setup(ECHO_PIN, GPIO.IN)

motor_pwm = GPIO.PWM(EN_A, 1000)
motor_pwm.start(0)

servo_pwms = []
for pin in SERVO_PINS:
    GPIO.setup(pin, GPIO.OUT)
    pwm = GPIO.PWM(pin, 50)
    pwm.start(0)
    servo_pwms.append(pwm)

def set_servo_angle(servo_index, angle):
    duty = 2.5 + (angle / 18.0)
    servo_pwms[servo_index].ChangeDutyCycle(duty)
    time.sleep(0.5)
    servo_pwms[servo_index].ChangeDutyCycle(0)

def open_cubby(cubby_num):
    index = cubby_num - 1
    print(f"\n[SERVO ACTION] Opening Servo Motor for Cubby #{cubby_num}...")
    set_servo_angle(index, 90)
    update_firebase(f"cubbies/{cubby_num}", {"servo_state": "Open"})

def close_cubby(cubby_num):
    index = cubby_num - 1
    print(f"[SERVO ACTION] Closing Servo Motor for Cubby #{cubby_num}...")
    set_servo_angle(index, 0)
    update_firebase(f"cubbies/{cubby_num}", {"servo_state": "Closed"})

def measure_distance():
    GPIO.output(TRIG_PIN, False)
    time.sleep(0.02)
    GPIO.output(TRIG_PIN, True)
    time.sleep(0.00001)
    GPIO.output(TRIG_PIN, False)

    pulse_start = time.time()
    pulse_end = time.time()

    while GPIO.input(ECHO_PIN) == 0:
        pulse_start = time.time()
        if pulse_start - pulse_end > 0.05: break

    while GPIO.input(ECHO_PIN) == 1:
        pulse_end = time.time()
        if pulse_end - pulse_start > 0.05: break

    pulse_duration = pulse_end - pulse_start
    return round(pulse_duration * 17150, 2)

def scan_ir_and_find_nearest_vacant():
    print("\n--------------------------------------------------")
    print("[IR SENSORS CHECK] Scanning all cubbies occupancy...")
    print("--------------------------------------------------")
    
    cubbies_data = []
    nearest_vacant = 1
    found_vacant = False

    for i, pin in enumerate(IR_PINS):
        status = GPIO.input(pin)
        is_occupied = (status == 0)
        status_str = "Occupied" if is_occupied else "Available"
        print(f" -> Cubby #{i+1} (GPIO {pin}): {status_str} [Raw Value: {status}]")
        
        cubbies_data.append({
            "id": i + 1,
            "occupied": is_occupied,
            "ir_status": status_str,
            "visitor": None
        })

        if not is_occupied and not found_vacant:
            nearest_vacant = i + 1
            found_vacant = True

    update_firebase("cubbyState", {
        "cubbies": cubbies_data,
        "updatedAt": time.time()
    })

    print(f"--------------------------------------------------")
    print(f"-> [RESULT] Nearest Vacant Cubby Assigned: #{nearest_vacant}")
    print(f"--------------------------------------------------\n")
    return nearest_vacant

def get_occupied_cubbies_from_hardware():
    occupied_list = []
    print("\n--------------------------------------------------")
    print("[HARDWARE IR CHECK] Deposited RFID Records List:")
    print("--------------------------------------------------")
    
    for i, pin in enumerate(IR_PINS):
        cubby_id = i + 1
        status = GPIO.input(pin)
        is_occupied = (status == 0)
        
        if is_occupied:
            rfid_uid = CUBBY_TO_RFID.get(cubby_id, "Unknown")
            occupied_list.append({"cubby": cubby_id, "rfid": rfid_uid})
            print(f" [OCCUPIED] Cubby #{cubby_id} | Linked RFID UID: {rfid_uid}")
        else:
            print(f" [AVAILABLE] Cubby #{cubby_id}")
            
    print(f"--------------------------------------------------\n")
    return occupied_list

def monitor_id_placement_and_close(cubby_num):
    print(f"\n--------------------------------------------------")
    print(f"[IR MONITORING] Actively watching Cubby #{cubby_num} for ID placement...")
    print(f"--------------------------------------------------")
    
    ir_pin = IR_PINS[cubby_num - 1]
    start_time = time.time()
    
    while True:
        status = GPIO.input(ir_pin)
        is_occupied = (status == 0)
        print(f" [Live IR Scan] Cubby #{cubby_num} status -> {'Occupied (ID Placed)' if is_occupied else 'Waiting for ID...'} [Raw: {status}]", end="\r")
        
        if is_occupied:
            print(f"\n[IR DETECTED SUCCESS] ID successfully placed in Cubby #{cubby_num}!")
            time.sleep(1)
            break
            
        if time.time() - start_time > 60:
            print(f"\n[TIMEOUT WARNING] ID placement monitoring timed out for Cubby #{cubby_num}.")
            break
            
        time.sleep(0.3)

    close_cubby(cubby_num)
    update_firebase("", {
        "state": "07-deposit-close-door",
        "timestamp": time.time()
    })
    print("-> [TRANSITION] Software advanced to door closed screen.")

latest_scanned_card = None

def rfid_background_worker():
    global latest_scanned_card
    reader = SimpleMFRC522()
    print("[RFID THREAD] Background reader listener started.")
    
    while True:
        try:
            card_id, text = reader.read_no_block()
            if card_id:
                latest_scanned_card = int(card_id)
                time.sleep(1.5)
            else:
                time.sleep(0.4)
        except Exception:
            time.sleep(0.5)

def main():
    global latest_scanned_card
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System - Active & Monitoring")
    print("--------------------------------------------------\n")

    reset_kiosk_firebase()

    rfid_thread = threading.Thread(target=rfid_background_worker, daemon=True)
    rfid_thread.start()

    time.sleep(2)
    last_check = 0
    last_processed_cmd = time.time() * 1000
    last_screen_checked = ""

    try:
        while True:
            current_time = time.time()

            if current_time - last_check > 0.3:
                last_check = current_time
                
                kiosk_data = get_kiosk_data()
                if not kiosk_data:
                    continue

                current_screen = kiosk_data.get("state", "01-idle")
                commands = kiosk_data.get("commands", {})

                # PIR Motion Check (Idle state)
                if current_screen == "01-idle":
                    current_motion_state = GPIO.input(PIR_PIN) == GPIO.HIGH
                    if current_motion_state:
                        print("\n[PIR RESULT] Motion detected! Waking up kiosk to select mode...")
                        update_firebase("", {
                            "motion_detected": True,
                            "state": "02-select-mode",
                            "timestamp": time.time()
                        })

                if current_screen == "11-withdraw-scan-rfid" and last_screen_checked != "11-withdraw-scan-rfid":
                    print("\n[EVENT RESULT] Entered Withdraw Scan Screen. Inspecting hardware IR records...")
                    get_occupied_cubbies_from_hardware()

                last_screen_checked = current_screen

                cmd_action = commands.get("action")
                cmd_ts = commands.get("timestamp", 0)
                
                if cmd_ts > last_processed_cmd:
                    if cmd_action == "start_deposit":
                        last_processed_cmd = cmd_ts
                        print("\n[EVENT RESULT] Deposit triggered! Scanning IR sensors...")

                        assigned_cubby = scan_ir_and_find_nearest_vacant()
                        time.sleep(1.0)

                        update_firebase("", {
                            "state": "05-deposit-scan-rfid",
                            "active_cubby": assigned_cubby,
                            "timestamp": time.time()
                        })
                        print(f"-> [TRANSITION] Proceeding to RFID scan screen for Cubby #{assigned_cubby}")

                    elif cmd_action == "start_withdraw":
                        last_processed_cmd = cmd_ts
                        print("\n[EVENT RESULT] Withdraw triggered! Inspecting physical hardware...")

                        get_occupied_cubbies_from_hardware()

                        update_firebase("", {
                            "state": "11-withdraw-scan-rfid",
                            "timestamp": time.time()
                        })
                        print("-> [TRANSITION] Proceeding to Withdraw RFID scan screen.")

                    elif cmd_action == "close_withdraw":
                        last_processed_cmd = cmd_ts
                        target_cubby = commands.get("cubby", 1)
                        print(f"\n[EVENT RESULT] Close withdraw triggered for Cubby #{target_cubby}!")

                        close_cubby(target_cubby)

                        update_firebase("", {
                            "state": "18-withdraw-complete",
                            "timestamp": time.time()
                        })
                        print(f"-> [TRANSITION] Cubby #{target_cubby} closed. Withdrawal sequence complete.")

            if latest_scanned_card is not None:
                card_id = latest_scanned_card
                latest_scanned_card = None

                kiosk_data = get_kiosk_data()
                current_screen = kiosk_data.get("state") if kiosk_data else ""

                if current_screen == "05-deposit-scan-rfid":
                    print(f"\n[RFID DEPOSIT SCAN] Scanned Card UID: {card_id}")
                    if card_id in RFID_TO_CUBBY:
                        scanned_cubby = RFID_TO_CUBBY[card_id]
                        software_target_cubby = kiosk_data.get("active_cubby")

                        if software_target_cubby is not None:
                            if scanned_cubby == software_target_cubby:
                                print(f"-> [VERIFICATION SUCCESS] Correct card! Opening Cubby #{software_target_cubby}")
                                open_cubby(software_target_cubby)
                                
                                update_firebase("", {
                                    "state": "06-deposit-cubby-open",
                                    "timestamp": time.time()
                                })

                                update_firebase("last_scan", {
                                    "card_id": str(card_id), 
                                    "cubby": software_target_cubby, 
                                    "timestamp": time.time()
                                })

                                monitor_id_placement_and_close(software_target_cubby)
                            else:
                                print(f"-> [SYSTEM WARNING] Incorrect RFID card scanned.")
                                update_firebase("last_scan", {
                                    "card_id": str(card_id),
                                    "cubby": scanned_cubby,
                                    "timestamp": time.time()
                                })
                    else:
                        print(f"-> [SYSTEM WARNING] Unknown Card ID.")

                elif current_screen == "11-withdraw-scan-rfid":
                    print(f"\n[RFID WITHDRAW SCAN] Scanned Card UID: {card_id}")
                    
                    active_hardware_deposits = get_occupied_cubbies_from_hardware()
                    matching_deposit = next((d for d in active_hardware_deposits if d["rfid"] == card_id), None)

                    if matching_deposit:
                        target_cubby = matching_deposit["cubby"]
                        print(f"-> [WITHDRAW SUCCESS] Scanned card matches physically occupied Cubby #{target_cubby}! Opening door...")
                        
                        open_cubby(target_cubby)

                        update_firebase("", {
                            "state": "14-withdraw-cubby-open",
                            "active_cubby": target_cubby,
                            "timestamp": time.time()
                        })

                        update_firebase("last_scan", {
                            "card_id": str(card_id),
                            "cubby": target_cubby,
                            "timestamp": time.time()
                        })
                    else:
                        print(f"-> [WITHDRAW WARNING] Scanned card UID {card_id} does not match any currently occupied cubby.")
                        # Send cubby as null/None so frontend catches the invalid card warning
                        update_firebase("last_scan", {
                            "card_id": str(card_id),
                            "cubby": None,
                            "timestamp": time.time()
                        })

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\nShutting down system safely...")
    finally:
        motor_pwm.stop()
        for pwm in servo_pwms:
            pwm.stop()
        GPIO.cleanup()

if __name__ == "__main__":
    main()