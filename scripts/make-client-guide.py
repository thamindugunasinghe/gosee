#!/usr/bin/env python3
"""Generate the GoSee client testing guide PDF (simple English).
Usage: python3 scripts/make-client-guide.py "<dashboard_url>" "<client_phone>"
Both args optional; placeholders are used if omitted."""
import sys
from fpdf import FPDF

def ascii_safe(t):
    # fpdf core fonts are latin-1 only; replace common typographic chars
    return (t.replace("—", "-").replace("–", "-").replace("’", "'")
             .replace("‘", "'").replace("“", '"').replace("”", '"')
             .replace("•", "-").replace("«", "<").replace("»", ">")
             .encode("latin-1", "replace").decode("latin-1"))

DASH_URL = sys.argv[1] if len(sys.argv) > 1 else "(your dashboard link - we will send it)"
CLIENT_PHONE = sys.argv[2] if len(sys.argv) > 2 else "(your phone number)"
DASH_URL = ascii_safe(DASH_URL)
CLIENT_PHONE = ascii_safe(CLIENT_PHONE)

NAVY = (10, 42, 94)
BLUE = (30, 95, 216)
GREEN = (34, 197, 94)
DARK = (20, 30, 55)
GRAY = (90, 100, 120)
LIGHT = (238, 242, 250)

WORDMARK = "logo/dashbordlogo.png"
MARK = "logo/applogo.png"


class Guide(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_y(8)
        self.image(MARK, x=10, y=7, w=8)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*NAVY)
        self.cell(0, 6, "GoSee - Client Testing Guide", align="R", new_x="LMARGIN", new_y="TOP")
        self.set_draw_color(*LIGHT)
        self.line(10, 17, 200, 17)
        self.set_xy(self.l_margin, 24)

    def footer(self):
        self.set_y(-14)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GRAY)
        self.cell(0, 6, f"GoSee  -  page {self.page_no()}", align="C")

    def _reset(self):
        # Deterministic left edge + full content width for every text block
        self.set_x(self.l_margin)

    def h1(self, text):
        self.ln(2)
        self._reset()
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*NAVY)
        self.multi_cell(self.epw, 9, text)
        self.set_draw_color(*BLUE)
        self.set_line_width(0.8)
        self.line(self.l_margin, self.get_y() + 1, self.l_margin + 26, self.get_y() + 1)
        self.ln(4)

    def h2(self, text):
        self.ln(2)
        self._reset()
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*BLUE)
        self.multi_cell(self.epw, 7, text)
        self.ln(1)

    def body(self, text):
        self._reset()
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(self.epw, 6, text)
        self.ln(1)

    def step(self, num, text):
        self._reset()
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(self.epw, 6, f"{num}.   {text}")

    def bullet(self, text):
        self._reset()
        self.set_font("Helvetica", "", 11)
        self.set_text_color(*DARK)
        self.multi_cell(self.epw, 6, f"-   {text}")

    def note(self, text):
        self._reset()
        self.set_fill_color(*LIGHT)
        self.set_text_color(*NAVY)
        self.set_font("Helvetica", "", 10)
        self.multi_cell(self.epw, 6, text, fill=True, border=0)
        self.ln(2)

    def kv(self, k, v):
        self._reset()
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*NAVY)
        self.cell(42, 7, k, border=0, new_x="RIGHT", new_y="TOP")
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*DARK)
        self.multi_cell(self.epw - 42, 7, v)


pdf = Guide()
pdf.set_auto_page_break(True, margin=16)
pdf.set_margins(14, 16, 14)

# ---------------- Cover ----------------
pdf.add_page()
pdf.ln(24)
_img_w = 95
pdf.image(WORDMARK, x=(210 - _img_w) / 2, y=pdf.get_y(), w=_img_w)
pdf.set_y(pdf.get_y() + 66)
pdf.set_x(pdf.l_margin)
pdf.set_font("Helvetica", "B", 24)
pdf.set_text_color(*NAVY)
pdf.cell(0, 14, "Client Testing Guide", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.set_font("Helvetica", "", 13)
pdf.set_text_color(*GRAY)
pdf.cell(0, 9, "A simple, step-by-step guide to try the GoSee system", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)
pdf.set_x(pdf.l_margin)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(*DARK)
pdf.multi_cell(pdf.epw, 7,
    "GoSee helps your team schedule supplier site visits automatically. This guide walks "
    "you through everything - installing the app, logging in, and trying each part of the "
    "system yourself. No technical knowledge needed. Just follow the steps in order.",
    align="C")
pdf.ln(8)
pdf.set_x(pdf.l_margin)
pdf.set_fill_color(*LIGHT)
pdf.set_text_color(*NAVY)
pdf.set_font("Helvetica", "B", 11)
pdf.multi_cell(pdf.epw, 8, "  Good to know", fill=True)
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(*DARK)
pdf.set_x(pdf.l_margin)
pdf.multi_cell(pdf.epw, 6,
    "  - This is a TEST version. Nothing you do is real - feel free to click around.\n"
    "  - All text messages (SMS) from the system will come to ONE phone: " + CLIENT_PHONE + ".\n"
    "  - When you are done testing, tell us and we will clear all the test data.")

# ---------------- Part 1: Install ----------------
pdf.add_page()
pdf.h1("Part 1 - Install the App")
pdf.body("The GoSee app is tested through TestFlight, Apple's official app for trying apps before "
         "they are on the App Store.")
pdf.h2("Step 1: Get TestFlight")
pdf.step(1, "Open the App Store on your iPhone.")
pdf.step(2, "Search for \"TestFlight\" and install it (blue icon, white propeller).")
pdf.step(3, "Open TestFlight and allow notifications if asked.")
pdf.h2("Step 2: Open your invitation")
pdf.step(1, "Open your email app and find the message from Apple TestFlight:")
pdf.body("     \"TestFlight: You're invited to test GoSee\"")
pdf.step(2, "Tap the blue \"View in TestFlight\" button.")
pdf.h2("Step 3: Install GoSee")
pdf.step(1, "TestFlight opens and shows the GoSee app.")
pdf.step(2, "Tap \"Accept\", then \"Install\".")
pdf.step(3, "Open it from TestFlight, or from the GoSee icon on your home screen.")
pdf.note("If you can't find the email, check Spam/Junk. If the button doesn't work, use the "
         "8-letter Invitation Code from the email: open TestFlight, tap \"Redeem\", and enter the code.")

# ---------------- Part 2: Logins ----------------
pdf.add_page()
pdf.h1("Part 2 - Your Logins")
pdf.body("You will use two things: the Dashboard (a website, for the Procurement manager) and the "
         "Mobile app (for Engineers and Suppliers). For this test, YOU play all the roles.")
pdf.h2("The Dashboard (website)")
pdf.kv("Link:", DASH_URL)
pdf.kv("Email:", "client.demo@gosee.lk")
pdf.kv("Password:", "GoSeeDemo2026")
pdf.body("Open the link in any web browser (Chrome/Safari) on a computer or phone.")
pdf.h2("The Mobile app - test logins")
pdf.body("Open the GoSee app and sign in with a mobile number below. The login code is always "
         "000000 (six zeros) - no real SMS needed to log in.")
pdf.ln(1)
# table
pdf.set_font("Helvetica", "B", 9)
pdf.set_fill_color(*NAVY)
pdf.set_text_color(255, 255, 255)
pdf.cell(45, 8, " Role", border=0, fill=True)
pdf.cell(60, 8, " Name", border=0, fill=True)
pdf.cell(45, 8, " Mobile", border=0, fill=True)
pdf.cell(32, 8, " Code", border=0, fill=True, new_x="LMARGIN", new_y="NEXT")
rows = [
    ("Engineer", "Nuwan Perera", "0771000001", "000000"),
    ("Engineer", "Kasun Silva", "0771000002", "000000"),
    ("Supplier", "Ajith (BrightSpark)", "0772000001", "000000"),
    ("Supplier", "Dilani (PowerGrid)", "0772000002", "000000"),
    ("Supplier", "Ruwan (Metro)", "0772000003", "000000"),
    ("Supplier", "Saman (BuildRight)", "0772000005", "000000"),
]
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*DARK)
for i, (role, name, mob, code) in enumerate(rows):
    fill = i % 2 == 0
    pdf.set_fill_color(*(LIGHT if fill else (255, 255, 255)))
    pdf.cell(45, 7, " " + role, border=0, fill=True)
    pdf.cell(60, 7, " " + name, border=0, fill=True)
    pdf.cell(45, 7, " " + mob, border=0, fill=True)
    pdf.cell(32, 7, " " + code, border=0, fill=True, new_x="LMARGIN", new_y="NEXT")
pdf.ln(2)
pdf.note("Tip: To switch roles in the app, tap the round profile button (top-right) and Sign out, "
         "then sign in with the next number.")

# ---------------- Part 3: Scenarios ----------------
pdf.add_page()
pdf.h1("Part 3 - Try the System (step by step)")
pdf.body("Follow these five scenarios in order. Together they show the full journey of a site visit. "
         "Watch " + CLIENT_PHONE + " - a text message arrives at each important step.")

pdf.h2("Scenario A - Create a job (Dashboard)")
pdf.step(1, "Open the Dashboard link and sign in (Part 2).")
pdf.step(2, "Click \"Create Job\".")
pdf.step(3, "Fill the PR number (e.g. PR-1001) and a short description.")
pdf.step(4, "Pick an Engineer (e.g. Nuwan Perera).")
pdf.step(5, "Choose a Category (Electrical) and Tier (High), then tick the suppliers shown.")
pdf.step(6, "Click \"Create job & notify engineer\".")
pdf.body("   Result: the engineer gets a text message - \"GoSee - New site visit\".")

pdf.h2("Scenario B - Engineer picks a visit time (App)")
pdf.step(1, "Open the app, sign in as the Engineer you chose (e.g. 0771000001, code 000000).")
pdf.step(2, "Tap the job, then \"Select visit time\".")
pdf.step(3, "Pick a day and a time slot, then Confirm.")
pdf.body("   Result: every supplier gets a text - \"GoSee - Visit invitation\".")

pdf.h2("Scenario C - Suppliers respond (App)")
pdf.step(1, "Sign out, then sign in as a Supplier (e.g. 0772000001, code 000000).")
pdf.step(2, "Open the invitation and tap \"Available\".")
pdf.step(3, "Repeat for the other suppliers (sign out / sign in each one).")
pdf.body("   Result: once three suppliers say Available, the visit is locked automatically and "
         "everyone gets \"GoSee - Visit confirmed\".")

pdf.h2("Scenario D - After the visit, engineer closes it (App)")
pdf.step(1, "The \"Close visit\" step becomes available after the visit time you picked has passed.")
pdf.step(2, "Sign in as the Engineer, open the job, tap \"Close visit\".")
pdf.step(3, "Mark who attended, then submit.")
pdf.body("   Result: Procurement gets a text - \"GoSee - Action needed\".")

pdf.h2("Scenario E - Procurement finishes the job (Dashboard)")
pdf.step(1, "On the Dashboard, open the same job.")
pdf.step(2, "Use the \"Final closure\" panel: Close the job, or Recirculate to invite fresh suppliers.")
pdf.body("   Result: the engineer is notified of the outcome by text.")

# ---------------- Part 4: Timing & SMS ----------------
pdf.add_page()
pdf.h1("Part 4 - Timing & Messages")
pdf.h2("The 3-day window")
pdf.body("GoSee asks the engineer to pick a visit time within the next 3 days. Some steps (like "
         "\"Close visit\") only unlock AFTER the visit time you picked has passed.")
pdf.bullet("To see the whole flow quickly, pick the earliest available time when scheduling.")
pdf.bullet("If you want us to fast-forward a visit so you can test the closing steps immediately, "
           "just message us and we will move it for you.")
pdf.h2("All messages come to one phone")
pdf.body("For this test, every text message the system sends (to engineers, suppliers, and "
         "procurement) is delivered to one number: " + CLIENT_PHONE + ". In real use, each person "
         "gets their own messages on their own phone.")
pdf.note("During \"Visit confirmed\", you may get several texts at once - one for each supplier plus "
         "the engineer and procurement. That is normal: it shows everyone is kept informed.")

pdf.h1("Troubleshooting")
pdf.bullet("\"Number not registered\" when logging into the app: use exactly the numbers in Part 2.")
pdf.bullet("Not getting text messages: they all go to " + CLIENT_PHONE + " - check that phone.")
pdf.bullet("App test version expires after 90 days. If it stops working, tell us and we'll send a new one.")
pdf.bullet("Anything confusing or broken - write it down and send it to us. That feedback is exactly "
           "what this test is for.")
pdf.ln(4)
pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*GREEN)
pdf.set_x(pdf.l_margin)
pdf.multi_cell(pdf.epw, 7, "Thank you for testing GoSee!")

pdf.output("GoSee_Client_Testing_Guide.pdf")
print("Wrote GoSee_Client_Testing_Guide.pdf")
