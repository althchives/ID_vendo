import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time
import firebase_admin
from firebase_admin import credentials, db

# --- FIREBASE SETUP USING DATABASE SECRET ---
firebase_admin.initialize_app(options={
    'databaseURL': 'https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app/',
    'databaseAuthVariableOverride': {
        'uid': 'raspberry-pi-kiosk'
    }
}, name='kiosk_app')

# --- GPIO SETUP ---
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# Sensors & Actuators Pins
PIR_PIN = 17
IR_PINS = [4, 18, 14, 16, 21, 15]  # Cubby 1 to 6 (Note updated GPIO 14 and 15)

# L298N Motor Driver Pins (Card Dispenser)
EN_A = 12
IN_1 = 27
IN_2 = 22

# Setup inputs and outputs
GPIO.setup(PIR_PIN, GPIO.IN)
for pin in IR_PINS:
    GPIO.setup(pin, GPIO.IN)

GPIO.setup(EN_A, GPIO.OUT)
GPIO.setup(IN_1, GPIO.OUT)
GPIO.setup(IN_2, GPIO.OUT)

# Initialize PWM for Motor Speed
motor_pwm = GPIO.PWM(EN_A, 1000)
motor_pwm.start(0)

def dispense_card():
    print("Dispensing card...")
    GPIO.output(IN_1, GPIO.HIGH)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(80) # Set speed
    time.sleep(2)
    GPIO.output(IN_1, GPIO.LOW)
    GPIO.output(IN_2, GPIO.LOW)
    motor_pwm.ChangeDutyCycle(0)
    print("Card dispensed.")

def main():
    reader = SimpleMFRC522()
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System Initialized             ")
    print(" Monitoring PIR, 6 IR Sensors, & L298N Motor      ")
    print("--------------------------------------------------\n")

    time.sleep(2)

    try:
        while True:
            # 1. PIR Motion Detection Phase
            if GPIO.input(PIR_PIN) == GPIO.HIGH:
                print("\n[MOTION DETECTED] PIR triggered! Updating Firebase...")
                db.reference('kiosk').update({
                    'motion_detected': True,
                    'timestamp': time.time()
                })
                
                # Optional: Monitor IR status across all cubbies
                for i, ir_pin in enumerate(IR_PINS):
                    status = GPIO.input(ir_pin)
                    print(f"Cubby {i+1} IR Sensor (GPIO {ir_pin}): {'Blocked' if status == 0 else 'Clear'}")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\nShutting down system safely...")
    finally:
        motor_pwm.stop()
        GPIO.cleanup()

if __name__ == "__main__":
    main()