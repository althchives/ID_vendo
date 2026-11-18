import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time
import requests

# --- FIREBASE REST API CONFIG ---
FIREBASE_URL = "https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app"
SECRET = "NHDkRkQ0PYBfSnVKuyESK5gWfsu9ubluRKhXaehJ"

def update_firebase(data_path, data_dict):
    try:
        url = f"{FIREBASE_URL}/kiosk/{data_path}.json?auth={SECRET}"
        requests.patch(url, json=data_dict, timeout=2)
    except Exception as e:
        print(f"[FIREBASE ERROR] Sync error: {e}")

def get_firebase_data(data_path):
    try:
        url = f"{FIREBASE_URL}/kiosk/{data_path}.json?auth={SECRET}"
        res = requests.get(url, timeout=2)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"[FIREBASE ERROR] Read error: {e}")
    return None

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

def dispense_card_until_detected():
    print("\n[MOTOR ACTION] Dispensing RFID card via DC Motor...")
    GPIO.output(IN_1, GPIO.HIGH)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(80)

    start_time = time.time()
    while True:
        dist = measure_distance()
        if (0 < dist < 8) or (time.time() - start_time > 2.5):
            break
        time.sleep(0.05)

    GPIO.output(IN_1, GPIO.LOW)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(0)
    print("[MOTOR ACTION SUCCESS] Card dropped and detected.")
    update_firebase("card_dispenser", {"last_dispensed": time.time()})

def scan_ir_and_find_nearest_vacant():
    print("\n--------------------------------------------------")
    print("[IR SENSORS CHECK] Scanning cubbies occupancy...")
    print("--------------------------------------------------")
    
    cubbies_data = []
    nearest_vacant = 1
    found_vacant = False

    for i, pin in enumerate(IR_PINS):
        status = GPIO.input(pin)
        is_occupied = (status == 0)
        status_str = "Occupied" if is_occupied else "Available"
        print(f" -> Cubby {i+1} (GPIO {pin}): {status_str}")
        
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

    print(f"-> [RESULT] Nearest Vacant Cubby Assigned: #{nearest_vacant}\n")
    return nearest_vacant

def monitor_id_placement_and_close(cubby_num):
    print(f"\n[MONITORING] Waiting for ID placement in Cubby #{cubby_num} via IR sensor...")
    ir_pin = IR_PINS[cubby_num - 1]
    
    start_time = time.time()
    while True:
        status = GPIO.input(ir_pin)
        is_occupied = (status == 0)
        
        if is_occupied:
            print(f"[IR DETECTED] ID successfully placed in Cubby #{cubby_num}!")
            time.sleep(1)
            break
            
        if time.time() - start_time > 60:
            print("[TIMEOUT] ID placement monitoring timed out.")
            break
            
        time.sleep(0.2)

    close_cubby(cubby_num)
    update_firebase("", {
        "state": "07-deposit-close-door",
        "timestamp": time.time()
    })
    print("-> [TRANSITION] Software advanced to door closed screen.")

def main():
    reader = SimpleMFRC522()
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System - Active")
    print("--------------------------------------------------\n")

    time.sleep(2)
    last_motion_state = None
    last_command_check = 0
    last_motion_check = 0
    last_processed_command_timestamp = 0

    try:
        while True:
            current_time = time.time()

            # 1. PIR Motion Sensor Check (Strictly wakes up from Idle)
            if current_time - last_motion_check > 0.5:
                last_motion_check = current_time
                current_motion_state = GPIO.input(PIR_PIN) == GPIO.HIGH
                if current_motion_state != last_motion_state:
                    last_motion_state = current_motion_state
                    if current_motion_state:
                        print("\n[PIR RESULT] Motion detected! Waking up kiosk...")
                        update_firebase("", {
                            "motion_detected": True,
                            "state": "02-select-mode",
                            "timestamp": time.time()
                        })
                    else:
                        update_firebase("", {
                            "motion_detected": False,
                            "timestamp": time.time()
                        })

            # 2. Check for 'Continue' button click on Deposit Details screen -> Initialize IR scan and assign active cubby, then stop at RFID scan page
            if current_time - last_command_check > 0.5:
                last_command_check = current_time
                commands = get_firebase_data("commands")
                if commands and commands.get("action") == "start_deposit":
                    cmd_ts = commands.get("timestamp", 0)
                    if cmd_ts > last_processed_command_timestamp:
                        last_processed_command_timestamp = cmd_ts
                        print("\n[EVENT RESULT] 'Continue' clicked! Initializing IR sensors for availability check...")

                        # Run IR sensor check and determine nearest vacant cubby
                        assigned_cubby = scan_ir_and_find_nearest_vacant()
                        time.sleep(1.0) # Brief pause on verification screen

                        # Stop and wait on the RFID scan screen with the assigned active cubby
                        update_firebase("", {
                            "state": "05-deposit-scan-rfid",
                            "active_cubby": assigned_cubby,
                            "timestamp": time.time()
                        })
                        print(f"-> [HOLD] Waiting for user to scan RFID card for Cubby #{assigned_cubby}")

            # 3. RFID Scan & Verification Phase (Only proceeds when correct card is scanned)
            card_id, text = reader.read_no_block()
            if card_id:
                print(f"\n[RFID RESULT] Scanned Card UID: {card_id}")
                
                if card_id in RFID_TO_CUBBY:
                    scanned_cubby = RFID_TO_CUBBY[card_id]
                    kiosk_root = get_firebase_data("")
                    software_target_cubby = kiosk_root.get("active_cubby") if kiosk_root else None

                    if software_target_cubby is not None:
                        if scanned_cubby == software_target_cubby:
                            print(f"-> [VERIFICATION SUCCESS] Card matches target Cubby #{software_target_cubby}!")
                            
                            dispense_card_until_detected()
                            open_cubby(software_target_cubby)
                            
                            update_firebase("last_scan", {
                                "card_id": str(card_id), 
                                "cubby": software_target_cubby, 
                                "timestamp": time.time()
                            })

                            # Now wait for physical ID placement before closing and advancing
                            monitor_id_placement_and_close(software_target_cubby)
                        else:
                            print(f"-> [SYSTEM WARNING] Incorrect RFID card scanned. Expected Cubby #{software_target_cubby}, got Cubby #{scanned_cubby}.")
                            update_firebase("last_scan", {
                                "card_id": str(card_id),
                                "cubby": scanned_cubby,
                                "timestamp": time.time()
                            })
                else:
                    print(f"-> [SYSTEM WARNING] Unknown Card ID.")

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