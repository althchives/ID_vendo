#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time

TRIG_PIN = 7   # Physical Pin 26
ECHO_PIN = 17  # Physical Pin 11 (via voltage divider)

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(TRIG_PIN, GPIO.OUT)
GPIO.setup(ECHO_PIN, GPIO.IN)

print("Testing HC-SR04 Sensor... Press Ctrl+C to stop.")

try:
    while True:
        # Send trigger pulse
        GPIO.output(TRIG_PIN, False)
        time.sleep(0.000002)
        GPIO.output(TRIG_PIN, True)
        time.sleep(0.00001)
        GPIO.output(TRIG_PIN, False)

        pulse_start = time.time()
        pulse_end = time.time()
        timeout = time.time() + 0.04

        while GPIO.input(ECHO_PIN) == 0:
            pulse_start = time.time()
            if time.time() > timeout:
                break

        while GPIO.input(ECHO_PIN) == 1:
            pulse_end = time.time()
            if time.time() > timeout:
                break

        duration = pulse_end - pulse_start
        distance = (duration * 34300) / 2
        
        print(f"Measured Distance: {distance:.1f} cm")
        time.sleep(1)

except KeyboardInterrupt:
    print("\nTest stopped.")
    GPIO.cleanup()