// Seeds a full demo dataset into the linked project (reads dashboard/.env.local).
// Idempotent: clears any previous demo run first. Prints the master OTP list and
// the demo login numbers. Undo everything with: node scripts/demo-reset.mjs
import { db, toE164, loadState, saveState, cleanup } from "./demo-lib.mjs";

const s = db();
const OTP = "000000";

// To receive REAL branded SMS on your own phone during the demo, run with your
// number, e.g.:  DEMO_ENGINEER_MOBILE=07XXXXXXXX node scripts/demo-seed.mjs
// (login still uses the master code 000000; only the action SMS go out for real).
const REAL_ENGINEER = process.env.DEMO_ENGINEER_MOBILE?.trim();
const REAL_SUPPLIER = process.env.DEMO_SUPPLIER_MOBILE?.trim();

// ---- demo people & companies ---------------------------------------------
const ENGINEERS = [
  { name: "Nuwan Perera", mobile: REAL_ENGINEER || "0771000001", department: "Electrical", designation: "Site Engineer" },
  { name: "Kasun Silva", mobile: "0771000002", department: "Civil", designation: "Site Engineer" },
];
const SUPPLIERS = [
  { company: "BrightSpark Electricals", contact: "Ajith Fernando", mobile: REAL_SUPPLIER || "0772000001", cat: "Electrical", tier: "High" },
  { company: "PowerGrid Solutions", contact: "Dilani Jayasuriya", mobile: "0772000002", cat: "Electrical", tier: "High" },
  { company: "Metro Electricals", contact: "Ruwan Bandara", mobile: "0772000003", cat: "Electrical", tier: "High" },
  { company: "Voltcare Services", contact: "Nadeesha Rathnayake", mobile: "0772000004", cat: "Electrical", tier: "Low" },
  { company: "BuildRight Civil", contact: "Saman Kumara", mobile: "0772000005", cat: "Civil", tier: "High" },
  { company: "StoneWorks Ltd", contact: "Ishara De Silva", mobile: "0772000006", cat: "Civil", tier: "High" },
];

async function getProcurementId() {
  const { data } = await s.from("profiles").select("id, name").in("role", ["procurement", "system_admin"]).limit(1);
  if (!data?.length) throw new Error("No Procurement user found — create your dashboard admin first (scripts/create-admin.mjs).");
  return data[0].id;
}

async function getOrCreateCategory(name, created) {
  const { data: found } = await s.from("categories").select("id").ilike("name", name).limit(1);
  if (found?.length) return found[0].id;
  const { data, error } = await s.from("categories").insert({ name, status: "active" }).select("id").single();
  if (error) throw error;
  created.categories.push({ id: data.id, name });
  return data.id;
}

async function getOrCreateTier(name, rank, created) {
  const { data: found } = await s.from("sub_categories").select("id").ilike("name", name).limit(1);
  if (found?.length) return found[0].id;
  const { data, error } = await s.from("sub_categories").insert({ name, rank, status: "active" }).select("id").single();
  if (error) throw error;
  created.tiers.push({ id: data.id, name });
  return data.id;
}

async function createUser(person, role, created) {
  const phone = toE164(person.mobile);
  const { data, error } = await s.auth.admin.createUser({ phone, phone_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const { error: pErr } = await s.from("profiles").insert({
    id: data.user.id,
    name: person.name ?? person.contact,
    mobile: phone,
    role,
    status: "active",
    department: person.department ?? null,
    designation: person.designation ?? null,
    preferred_language: "en",
  });
  if (pErr) throw pErr;
  created.users.push(data.user.id);
  return data.user.id;
}

async function insertJob({ pr, description, engineerId, procurementId, catId, tierId, supplierIds, priority = "normal", status, selectedTime = null, cutoff = null, responses = {}, attendance = {}, jobStatus = "active", closureBy = null }, created) {
  const { data: job, error: jErr } = await s.from("jobs").insert({
    pr_reference: pr, description, engineer_id: engineerId, location: "Kurunegala Plant",
    priority, main_category_id: catId, sub_category_id: tierId, status: jobStatus, created_by: procurementId,
  }).select("id").single();
  if (jErr) throw jErr;
  created.jobs.push(job.id);

  const { data: cycle, error: cErr } = await s.from("job_cycles").insert({
    job_id: job.id, cycle_no: 0, status, selected_time: selectedTime, response_cutoff: cutoff,
    confirmation_source: status === "CONFIRMED" || status === "AWAITING_PROCUREMENT_CLOSE" || jobStatus === "closed" ? "auto_threshold" : null,
    confirmed_at: selectedTime && status !== "AWAITING_ENGINEER_TIME" && status !== "AWAITING_SUPPLIER_RESPONSES" ? new Date().toISOString() : null,
  }).select("id").single();
  if (cErr) throw cErr;

  for (const sid of supplierIds) {
    await s.from("cycle_suppliers").insert({
      cycle_id: cycle.id, supplier_id: sid,
      invited_at: status === "AWAITING_ENGINEER_TIME" ? null : new Date().toISOString(),
      response_status: responses[sid] ?? "pending",
      response_at: responses[sid] ? new Date().toISOString() : null,
      attendance_status: attendance[sid] ?? "not_marked",
    });
  }
  if (closureBy) {
    await s.from("engineer_closures").insert({ cycle_id: cycle.id, visit_happened: true, closed_by: closureBy });
  }
  return job.id;
}

async function main() {
  console.log("Clearing any previous demo run…");
  await cleanup(s, loadState());

  const created = { categories: [], tiers: [], users: [], suppliers: [], jobs: [], createdAt: new Date().toISOString() };
  const procurementId = await getProcurementId();

  console.log("Creating categories & tiers…");
  const cat = {
    Electrical: await getOrCreateCategory("Electrical", created),
    Civil: await getOrCreateCategory("Civil", created),
    Mechanical: await getOrCreateCategory("Mechanical", created),
  };
  const tier = {
    High: await getOrCreateTier("High", 1, created),
    Medium: await getOrCreateTier("Medium", 2, created),
    Low: await getOrCreateTier("Low", 3, created),
  };

  console.log("Creating engineers…");
  const eng = {};
  for (const e of ENGINEERS) eng[e.name] = await createUser(e, "engineer", created);

  console.log("Creating suppliers…");
  const sup = {};
  for (const su of SUPPLIERS) {
    const contactId = await createUser({ name: su.contact, mobile: su.mobile }, "supplier_contact", created);
    const { data: company, error } = await s.from("supplier_companies").insert({
      company_name: su.company, contact_user_id: contactId, tier_id: tier[su.tier], status: "active",
      address: "Industrial Zone, Kurunegala", availability_contact: su.contact,
    }).select("id").single();
    if (error) throw error;
    created.suppliers.push(company.id);
    await s.from("supplier_categories").insert({ supplier_id: company.id, category_id: cat[su.cat] });
    sup[su.company] = company.id;
  }

  const elecHigh = [sup["BrightSpark Electricals"], sup["PowerGrid Solutions"], sup["Metro Electricals"]];
  const civilHigh = [sup["BuildRight Civil"], sup["StoneWorks Ltd"]];
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  console.log("Creating demo jobs across every state…");
  // 1) Fresh — engineer must pick a time (live scheduler demo)
  await insertJob({
    pr: "DEMO-1001", description: "Transformer inspection at main substation", engineerId: eng["Nuwan Perera"],
    procurementId, catId: cat.Electrical, tierId: tier.High, supplierIds: elecHigh, priority: "urgent",
    status: "AWAITING_ENGINEER_TIME",
  }, created);

  // 2) Time selected, 2 of 3 suppliers already Available — so logging in as the
  //    third supplier (Metro Electricals / 0772000003) and tapping Available
  //    auto-confirms the visit LIVE during the demo.
  await insertJob({
    pr: "DEMO-1002", description: "Switchgear preventive maintenance", engineerId: eng["Kasun Silva"],
    procurementId, catId: cat.Electrical, tierId: tier.High, supplierIds: elecHigh,
    status: "AWAITING_SUPPLIER_RESPONSES", selectedTime: iso(now + 2 * 864e5 + 36e5 * 10),
    cutoff: iso(now + 2 * 864e5 - 14 * 36e5),
    responses: { [elecHigh[0]]: "available", [elecHigh[1]]: "available" },
  }, created);

  // 3) Confirmed
  await insertJob({
    pr: "DEMO-1003", description: "Boundary wall condition survey", engineerId: eng["Nuwan Perera"],
    procurementId, catId: cat.Civil, tierId: tier.High, supplierIds: civilHigh,
    status: "CONFIRMED", selectedTime: iso(now + 864e5 + 36e5 * 14),
    responses: Object.fromEntries(civilHigh.map((id) => [id, "available"])),
  }, created);

  // 4) Visit done — awaiting procurement close (live close/recirculate demo)
  await insertJob({
    pr: "DEMO-1004", description: "Distribution panel wiring audit", engineerId: eng["Kasun Silva"],
    procurementId, catId: cat.Electrical, tierId: tier.High, supplierIds: elecHigh,
    status: "AWAITING_PROCUREMENT_CLOSE", selectedTime: iso(now - 3 * 36e5),
    responses: Object.fromEntries(elecHigh.map((id) => [id, "available"])),
    attendance: Object.fromEntries(elecHigh.map((id) => [id, "attended"])),
    closureBy: eng["Kasun Silva"],
  }, created);

  // 5) Completed
  await insertJob({
    pr: "DEMO-1005", description: "Warehouse lighting replacement", engineerId: eng["Nuwan Perera"],
    procurementId, catId: cat.Electrical, tierId: tier.High, supplierIds: elecHigh,
    status: "CLOSED", jobStatus: "closed", selectedTime: iso(now - 5 * 864e5),
    responses: Object.fromEntries(elecHigh.map((id) => [id, "available"])),
    attendance: Object.fromEntries(elecHigh.map((id) => [id, "attended"])),
  }, created);

  saveState(created);

  const allPhones = [...ENGINEERS, ...SUPPLIERS].map((p) => toE164(p.mobile).slice(1)); // strip leading +
  const otpList = allPhones.map((p) => `${p}=${OTP}`).join(",");

  console.log("\n==================== DEMO READY ====================");
  console.log("Engineers (mobile app login):");
  ENGINEERS.forEach((e) => console.log(`  ${e.name.padEnd(16)} ${e.mobile}   OTP ${OTP}`));
  console.log("Suppliers (mobile app login):");
  SUPPLIERS.forEach((su) => console.log(`  ${su.contact.padEnd(20)} ${su.mobile}   OTP ${OTP}   (${su.company})`));
  console.log("\nDashboard: sign in with your existing Procurement email/password.");
  console.log("\n---- Paste this into Supabase → Auth → Phone → Test OTP ----");
  console.log(otpList);
  console.log("-----------------------------------------------------------");
  console.log("\nJobs created: DEMO-1001 (pick time) · 1002 (responses) · 1003 (confirmed) · 1004 (close/recirculate) · 1005 (closed)");
  console.log("Reset everything later with:  node scripts/demo-reset.mjs\n");
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message ?? e);
  process.exit(1);
});
