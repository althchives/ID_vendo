import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time
import requests

# --- FIREBASE REST API CONFIG ---
FIREBASE_URL = "https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app/kiosk"
SECRET = "NHDkRkQ0PYBfSnVKuyESK5gWfsu9ubluRKhXaehJ"

def update_firebase(data_path, data_dict):
    """Sends updates to Firebase securely via REST API"""
    try:
        url = f"{FIREBASE_URL}/{data_path}.json?auth={SECRET}"
        requests.patch(url, json=data_dict, timeout=2)
    except Exception as e:
        print(f"Firebase sync error: {e}")

# --- GPIO SETUP ---
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# --- PIN MAPPINGS (Cubbies 1 to 6) ---
PIR_PIN = 17
IR_PINS = [4, 18, 14, 16, 21, 15]          
SERVO_PINS = [5, 6, 13, 19, 26, 20]        

EN_A = 12
IN_1 = 27
IN_2 = 22

RFID_TO_CUBBY = {
    584192329369: 1,  # Cubby 1 Tag[cite: 8]
    584182872247: 2,  # Cubby 2 Tag[cite: 9]
    584195475145: 3,  # Cubby 3 Tag[cite: 10]
    584186054775: 4,  # Cubby 4 Tag
    584187072384: 5,  # Cubby 5 Tag
    584183954977: 6   # Cubby 6 Tag
}

GPIO.setup(PIR_PIN, GPIO.IN)
for pin in IR_PINS:
    GPIO.setup(pin, GPIO.IN)

GPIO.setup(EN_A, GPIO.OUT)
GPIO.setup(IN_1, GPIO.OUT)
GPIO.setup(IN_2, GPIO.OUT)

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
    print(f"\n[SERVO ACTION] Opening Cubby {cubby_num}...")
    set_servo_angle(index, 90)
    update_firebase(f"cubbies/{cubby_num}", {"servo_state": "Open"})

def close_cubby(cubby_num):
    index = cubby_num - 1
    print(f"\n[SERVO ACTION] Closing Cubby {cubby_num}...")
    set_servo_angle(index, 0)
    update_firebase(f"cubbies/{cubby_num}", {"servo_state": "Closed"})

def dispense_card():
    print("\n[MOTOR ACTION] Dispensing card...")
    GPIO.output(IN_1, GPIO.HIGH)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(80)
    time.sleep(2)
    GPIO.output(IN_1, GPIO.LOW)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(0)
    print("[MOTOR ACTION] Card dispensed successfully.")
    update_firebase("card_dispenser", {"last_dispensed": time.time()})

def main():
    reader = SimpleMFRC522()
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System (Dynamic PIR Monitoring)")
    print("--------------------------------------------------\n")

    time.sleep(2)
    last_motion_state = None

    try:
        while True:
            # 1. Dynamic PIR Motion Detection Phase
            current_motion_state = GPIO.input(PIR_PIN) == GPIO.HIGH
            
            # Only update Firebase if the state actually changes to avoid spamming network requests
            if current_motion_state != last_motion_state:
                last_motion_state = current_motion_state
                
                if current_motion_state:
                    print("\n[MOTION DETECTED] PIR triggered (True)")
                    update_firebase("", {"motion_detected": True, "timestamp": time.time()})
                    
                    # Scan all IR sensor statuses when motion happens
                    for i, ir_pin in enumerate(IR_PINS):
                        status = GPIO.input(ir_pin)
                        status_str = "Blocked" if status == 0 else "Clear"
                        print(f"Cubby {i+1} IR Sensor (GPIO {ir_pin}): {status_str}")
                        update_firebase(f"cubbies/{i+1}", {"ir_status": status_str})
                else:
                    print("\n[NO MOTION] PIR cleared (False)")
                    update_firebase("", {"motion_detected": False, "timestamp": time.time()})

            # 2. RFID Reader Check (Non-blocking scan)
            card_id, text = reader.read_no_block()
            
            if card_id:
                print(f"\n[RFID SCANNED] Detected Card ID: {card_id}")
                
                if card_id in RFID_TO_CUBBY:
                    cubby_num = RFID_TO_CUBBY[card_id]
                    ir_pin = IR_PINS[cubby_num - 1]
                    ir_status = GPIO.input(ir_pin)
                    
                    print(f"-> Tag matched to Cubby {cubby_num}!")
                    
                    open_cubby(cubby_num)
                    time.sleep(3)
                    close_cubby(cubby_num)
                    dispense_card()
                    
                    update_firebase("last_scan", {"card_id": str(card_id), "cubby": cubby_num, "timestamp": time.time()})
                else:
                    print(f"-> Unknown Card ID: {card_id}. Access Denied.")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\nShutting down system safely...")
    finally:
        motor_pwm.stop()
        for pwm in servo_pwms:
            pwm.stop()
        GPIO.cleanup()

if __name__ == "__main__":
    main()