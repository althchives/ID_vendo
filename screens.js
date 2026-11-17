import { renderIdle } from "./idle.js";
import { renderSelectMode } from "./select_mode.js";
import { renderDepositDetails } from "./deposit.js";

export const SCREENS = [
  { id: "01-idle", num: "01", badge: "Idle", label: "Idle" },
  { id: "02-select-mode", num: "02", badge: "Select mode", label: "Select Mode" },
  { id: "03-deposit-details", num: "03", badge: "Deposit", label: "Deposit Details" },
  { id: "04-deposit-verifying", num: "04", badge: "Deposit", label: "Verifying" },
  { id: "05-deposit-scan-rfid", num: "05", badge: "Deposit", label: "Scan RFID" },
  { id: "06-deposit-cubby-open", num: "06", badge: "Deposit", label: "Cubby Open" },
  { id: "07-deposit-close-door", num: "07", badge: "Deposit", label: "Close Door" },
  { id: "08-deposit-door-warning", num: "08", badge: "Warning", label: "Door Warning" },
  { id: "09-deposit-no-id-warning", num: "09", badge: "Warning", label: "No ID Warning" },
  { id: "10-deposit-complete", num: "10", badge: "Complete", label: "Deposit Done" },
  { id: "11-withdraw-scan-rfid", num: "11", badge: "Withdraw", label: "Scan RFID" },
  { id: "12-withdraw-verifying", num: "12", badge: "Withdraw", label: "Verifying" },
  { id: "13-withdraw-invalid-rfid", num: "13", badge: "Warning", label: "Invalid RFID" },
  { id: "14-withdraw-cubby-open", num: "14", badge: "Withdraw", label: "Take ID" },
  { id: "15-withdraw-close-door", num: "15", badge: "Withdraw", label: "Close Door" },
  { id: "16-withdraw-id-still-inside", num: "16", badge: "Warning", label: "ID Inside Warn" },
  { id: "17-withdraw-door-warning", num: "17", badge: "Warning", label: "Door Warning" },
  { id: "18-withdraw-complete", num: "18", badge: "Complete", label: "Withdraw Done" }
];