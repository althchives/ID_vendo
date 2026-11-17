import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time
import firebase_admin
from firebase_admin import credentials, db

# --- FIREBASE SETUP ---
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# --- PIN SETUP ---
SERVO_PINS = [5, 6, 13, 19, 26, 20]
PIR_PIN = 17  # GPIO 17 (Physical Pin 11)

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(PIR_PIN, GPIO.IN)

# Initialize Servos... (keep your existing servo initialization code here)

def main():
    reader = SimpleMFRC522()
    print("--------------------------------------------------")
    print(" Smart Cubby Kiosk System Initialized             ")
    print(" PIR Motion Sensor Active (GPIO 17)               ")
    print("--------------------------------------------------\n")

    time.sleep(2)

    try:
        while True:
            # 1. PIR Motion Detection Phase
            print("Waiting for motion...")
            while True:
                if GPIO.input(PIR_PIN) == GPIO.HIGH:
                    print("\n[MOTION DETECTED] PIR triggered! Updating Firebase...")
                    
                    # Update Firebase so Vercel UI wakes up instantly
                    db.reference('kiosk').update({
                        'motion_detected': True,
                        'timestamp': time.time()
                    })
                    break
                time.sleep(0.2)

            # 2. RFID Read Phase
            print("Waiting for card tap...")
            try:
                card_id, text = reader.read_no_block() # Use non-blocking or standard read safely
                if card_id:
                    clean_text = text.strip().lower()
                    print(f"-> Scanned UID: {card_id}")
                    print(f"-> Card Data: '{clean_text}'")
                    
                    # Match cubby logic here...
            except Exception as e:
                print(f"RFID Reader note: {e}")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\nShutting down system safely...")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    main()