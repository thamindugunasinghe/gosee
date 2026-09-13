# Go See Mobile

Single Expo (React Native) app for Engineers and Suppliers. Role is determined after
mobile-number OTP login; engineers see the scheduler/attendance flows, supplier contacts
see the invitation/response flows. Dark card-based design (see ../PLAN.md Phases 4–8).

## Run it

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (App Store / Play Store) on the phone.
The phone and the Mac must be on the same Wi-Fi network.

## Screens

- **Login / OTP** — mobile number → 6-digit SMS code (requires the Auth Send-SMS hook)
- **Engineer** — job inbox with action filters → job detail → 3-day slot scheduler with
  supplier-visit suggestions; confirming a time sends N-02 invitations to all suppliers
- **Supplier** — invitation inbox with Available / Not available; the third Available
  response auto-confirms and locks the visit (N-03 to everyone)

Config (`.env`) holds only the public Supabase URL + anon key — never the service key.
