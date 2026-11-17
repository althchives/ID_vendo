import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time

# --- GPIO SETUP ---
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# --- PIN MAPPINGS (Cubbies 1 to 6) ---
PIR_PIN = 17
IR_PINS = [4, 18, 14, 16, 21, 15]          # IR Sensors for Cubbies 1-6 (Cubby 3 on GPIO 14, Cubby 6 on GPIO 15)
SERVO_PINS = [5, 6, 13, 19, 26, 20]        # Servo Motors for Cubbies 1-6

# L298N Motor Driver Pins (Card Dispenser DC Motor)
EN_A = 12
IN_1 = 27
IN_2 = 22

# --- MAP RFID TAG IDs TO CUBBY NUMBERS (1 to 6) ---
# Mapped directly from your NDEF / NFC tag records:
RFID_TO_CUBBY = {
    584192329369: 1,  # Cubby 1 Tag (Tag ID: 04:93:86:DE:45:02:89)[cite: 8]
    584182872247:   2,  # Cubby 2 Tag (Tag ID: 04:03:38:2C:45:02:89)[cite: 9]
    584195475145:  3,  # Cubby 3 Tag (Tag ID: 04:C3:86:D2:45:02:89)[cite: 10]
    584186054775:   4,  # Cubby 4 Tag (Tag ID: 04:33:C8:63:45:02:89)[cite: 11]
    584187072384:   5,  # Cubby 5 Tag (Tag ID: 04:43:4F:74:45:02:89)[cite: 12]
    584183954977:   6   # Cubby 6 Tag (Tag ID: 04:13:BE:68:45:02:89)[cite: 13]
}

# --- SETUP INPUTS AND OUTPUTS ---
GPIO.setup(PIR_PIN, GPIO.IN)
for pin in IR_PINS:
    GPIO.setup(pin, GPIO.IN)

GPIO.setup(EN_A, GPIO.OUT)
GPIO.setup(IN_1, GPIO.OUT)
GPIO.setup(IN_2, GPIO.OUT)

# Initialize PWM for Card Dispenser DC Motor Speed
motor_pwm = GPIO.PWM(EN_A, 1000)
motor_pwm.start(0)

# Initialize PWM for all 6 Cubby Servos (50Hz frequency standard for SG90 servos)
servo_pwms = []
for pin in SERVO_PINS:
    GPIO.setup(pin, GPIO.OUT)
    pwm = GPIO.PWM(pin, 50)
    pwm.start(0)
    servo_pwms.append(pwm)

def set_servo_angle(servo_index, angle):
    # Convert angle (0-180) to duty cycle (2.5% - 12.5%)
    duty = 2.5 + (angle / 18.0)
    servo_pwms[servo_index].ChangeDutyCycle(duty)
    time.sleep(0.5)
    servo_pwms[servo_index].ChangeDutyCycle(0) # Stop pulse to prevent servo jitter

def open_cubby(cubby_num):
    index = cubby_num - 1
    print(f"\n[SERVO ACTION] Opening Cubby {cubby_num} (Servo GPIO {SERVO_PINS[index]})...")
    set_servo_angle(index, 90) # Adjust angle (e.g., 90 or 180) depending on your latch mechanism

def close_cubby(cubby_num):
    index = cubby_num - 1
    print(f"\n[SERVO ACTION] Closing Cubby {cubby_num} (Servo GPIO {SERVO_PINS[index]})...")
    set_servo_angle(index, 0)

def dispense_card():
    print("\n[MOTOR ACTION] Dispensing card...")
    GPIO.output(IN_1, GPIO.HIGH)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(80) # 80% speed
    time.sleep(2)
    GPIO.output(IN_1, GPIO.LOW)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(0)
    print("[MOTOR ACTION] Card dispensed successfully.")

def main():
    reader = SimpleMFRC522()
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System Initialized (Standalone) ")
    print(" PIR, 6 IRs, 6 Servos, RFID Tags, & Card Dispenser")
    print("--------------------------------------------------\n")

    time.sleep(2)

    try:
        while True:
            # 1. PIR Motion Detection Phase
            if GPIO.input(PIR_PIN) == GPIO.HIGH:
                print("\n[MOTION DETECTED] PIR triggered locally!")
                for i, ir_pin in enumerate(IR_PINS):
                    status = GPIO.input(ir_pin)
                    print(f"Cubby {i+1} IR Sensor (GPIO {ir_pin}): {'Blocked' if status == 0 else 'Clear'}")

            # 2. RFID Reader Check (Non-blocking scan)
            card_id, text = reader.read_no_block()
            
            if card_id:
                print(f"\n[RFID SCANNED] Detected Card ID: {card_id}")
                
                # Check if scanned RFID card matches a designated cubby tag
                if card_id in RFID_TO_CUBBY:
                    cubby_num = RFID_TO_CUBBY[card_id]
                    ir_pin = IR_PINS[cubby_num - 1]
                    ir_status = GPIO.input(ir_pin)
                    
                    print(f"-> Tag matched to **Cubby {cubby_num}**!")
                    print(f"-> Cubby {cubby_num} IR Sensor (GPIO {ir_pin}) Status: {'Blocked (Item inside)' if ir_status == 0 else 'Clear (Empty)'}")
                    
                    # Trigger the specific servo motor for this cubby
                    open_cubby(cubby_num)
                    time.sleep(3) # Leave cubby open for item insertion/retrieval
                    close_cubby(cubby_num)
                    
                    # Optionally trigger card dispenser for the transaction
                    dispense_card()
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