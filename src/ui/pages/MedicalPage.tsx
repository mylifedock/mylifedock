import { useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getMedicalRecords,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  COMMON_DEPARTMENTS,
  parseMedicalOcrText,
  type CreateMedicalRecordInput,
} from "../../application/medicalService";
import type { MedicalRecord, MedicalRecordType } from "../../infrastructure/database/db";
import { useToast } from "../components/Toast";
import { AttachmentManager } from "../components/AttachmentManager";
import { addAttachment } from "../../application/attachmentService";

export function MedicalPage() {
  const records = useLiveQuery(() => getMedicalRecords(), [], []);
  const { showToast } = useToast();

  // Sub-module filter: 'all' | 'prescription' | 'lab_report'
  const [activeSubModule, setActiveSubModule] = useState<"all" | MedicalRecordType>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<MedicalRecord | null>(null);

  // Form fields
  const [formData, setFormData] = useState<CreateMedicalRecordInput>({
    type: "prescription",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    department: "General",
    doctorOrClinic: "",
    diagnosis: "",
    medicationsOrSummary: "",
    followUpDate: "",
    reminderEnabled: true,
  });

  // Attachment state for the new/edit form
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Refs for hidden file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);
  const ocrCameraInputRef = useRef<HTMLInputElement>(null);

  // Collect distinct departments from records + common list
  const availableDepartments = Array.from(
    new Set([
      "General",
      ...records.map((r) => r.department || "General"),
      ...COMMON_DEPARTMENTS,
    ])
  ).sort();

  function openCreateForm(initialType: MedicalRecordType = "prescription") {
    setEditingRecord(null);
    setPendingFile(null);
    setIsOcrScanning(false);
    setOcrProgress(0);
    setFormData({
      type: initialType,
      title: "",
      date: new Date().toISOString().slice(0, 10),
      department: "General",
      doctorOrClinic: "",
      diagnosis: "",
      medicationsOrSummary: "",
      followUpDate: "",
      reminderEnabled: true,
    });
    setShowForm(true);
  }

  function openEditForm(record: MedicalRecord) {
    setEditingRecord(record);
    setPendingFile(null);
    setIsOcrScanning(false);
    setOcrProgress(0);
    setFormData({
      type: record.type,
      title: record.title,
      date: record.date || new Date().toISOString().slice(0, 10),
      department: record.department || "General",
      doctorOrClinic: record.doctorOrClinic || "",
      diagnosis: record.diagnosis || "",
      medicationsOrSummary: record.medicationsOrSummary || "",
      followUpDate: record.followUpDate || "",
      reminderEnabled: Boolean(record.followUpDate),
    });
    setShowForm(true);
  }

  // Handle Smart OCR Auto-Fill (Beta)
  async function handleOcrScan(file: File) {
    if (!file) return;
    try {
      setIsOcrScanning(true);
      setOcrProgress(10);
      setPendingFile(file);

      const { extractTextFromImage } = await import("../../application/ocrService");
      const extractedText = await extractTextFromImage(file, (p) => {
        setOcrProgress(p);
      });

      const parsed = parseMedicalOcrText(extractedText);

      setFormData((prev) => ({
        ...prev,
        type: parsed.detectedType || prev.type,
        date: parsed.detectedDate || prev.date,
        department: parsed.detectedDepartment || prev.department || "General",
        doctorOrClinic: parsed.detectedDoctorOrClinic || prev.doctorOrClinic,
        title: prev.title.trim()
          ? prev.title
          : (parsed.detectedType === "lab_report" ? `Lab Report - ${parsed.detectedDepartment}` : `Consultation - ${parsed.detectedDepartment}`),
        medicationsOrSummary: parsed.detectedSummary
          ? (prev.medicationsOrSummary ? `${prev.medicationsOrSummary}\n\n[OCR Detected]:\n${parsed.detectedSummary}` : parsed.detectedSummary)
          : prev.medicationsOrSummary,
      }));

      showToast("✨ Auto-filled from medical document! Please review fields.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to read text from this image. You can still fill manually.", "error");
    } finally {
      setIsOcrScanning(false);
      setOcrProgress(0);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const titleToSave = formData.title.trim() ||
      (formData.type === "prescription"
        ? `Consultation - ${formData.department || "General"}`
        : `Lab Report - ${formData.department || "General"}`);

    const payload = {
      ...formData,
      title: titleToSave,
      department: formData.department?.trim() || "General",
    };

    try {
      if (editingRecord) {
        await updateMedicalRecord(editingRecord.id, payload);
        if (pendingFile) {
          await addAttachment({ documentId: editingRecord.id, file: pendingFile });
        }
        showToast("Medical record updated successfully", "success");
      } else {
        const newId = await createMedicalRecord(payload);
        if (pendingFile) {
          await addAttachment({ documentId: newId, file: pendingFile });
        }
        showToast(
          payload.type === "prescription"
            ? "Prescription saved to medical profile"
            : "Lab report saved to medical profile",
          "success"
        );
      }
      setShowForm(false);
      setEditingRecord(null);
      setPendingFile(null);
    } catch {
      showToast("Failed to save medical record", "error");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this medical record and its attachments?")) {
      return;
    }
    try {
      await deleteMedicalRecord(id);
      if (selectedRecordForDetail?.id === id) {
        setSelectedRecordForDetail(null);
      }
      showToast("Record deleted", "success");
    } catch {
      showToast("Failed to delete record", "error");
    }
  }

  // Filter & sort records
  const filteredRecords = records
    .filter((r) => {
      if (activeSubModule !== "all" && r.type !== activeSubModule) {
        return false;
      }
      if (selectedDepartment !== "all" && r.department !== selectedDepartment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.title.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          (r.doctorOrClinic && r.doctorOrClinic.toLowerCase().includes(q)) ||
          (r.diagnosis && r.diagnosis.toLowerCase().includes(q)) ||
          (r.medicationsOrSummary && r.medicationsOrSummary.toLowerCase().includes(q)) ||
          (r.date && r.date.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a.date || a.createdAt;
      const dateB = b.date || b.createdAt;
      return sortOrder === "newest"
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

  // Calculate Health Stats
  const prescriptionCount = records.filter((r) => r.type === "prescription").length;
  const labReportCount = records.filter((r) => r.type === "lab_report").length;
  const activeFollowUpsCount = records.filter(
    (r) => r.followUpDate && new Date(r.followUpDate) >= new Date(new Date().toISOString().slice(0, 10))
  ).length;

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">🩺 Medical & Health Records</h1>
          <p className="page-subtitle">
            Securely preserve doctor prescriptions, diagnostic lab reports, and follow-up schedules date-wise.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => openCreateForm("lab_report")}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>🔬</span> + Add Lab Report
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => openCreateForm("prescription")}
            style={{ display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>💊</span> + Add Prescription
          </button>
        </div>
      </div>

      {/* Health Overview Stats */}
      <div className="stats-grid" style={{ marginBottom: "20px" }}>
        <div className="stat-card" style={{ cursor: "default" }}>
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.12)", color: "#818cf8" }}>
            🩺
          </div>
          <div>
            <div className="stat-value">{records.length}</div>
            <div className="stat-label">Total Health Records</div>
          </div>
        </div>

        <div
          className="stat-card"
          onClick={() => setActiveSubModule("prescription")}
          style={{ cursor: "pointer", border: activeSubModule === "prescription" ? "1px solid #818cf8" : undefined }}
        >
          <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa" }}>
            💊
          </div>
          <div>
            <div className="stat-value">{prescriptionCount}</div>
            <div className="stat-label">Prescriptions & Consultations</div>
          </div>
        </div>

        <div
          className="stat-card"
          onClick={() => setActiveSubModule("lab_report")}
          style={{ cursor: "pointer", border: activeSubModule === "lab_report" ? "1px solid #34d399" : undefined }}
        >
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#34d399" }}>
            🔬
          </div>
          <div>
            <div className="stat-value">{labReportCount}</div>
            <div className="stat-label">Lab Reports & Diagnostics</div>
          </div>
        </div>

        <div className="stat-card" style={{ cursor: "default" }}>
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}>
            ⏰
          </div>
          <div>
            <div className="stat-value">{activeFollowUpsCount}</div>
            <div className="stat-label">Upcoming Follow-Ups</div>
          </div>
        </div>
      </div>

      {/* Sub-module Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: "16px", display: "flex", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`tab ${activeSubModule === "all" ? "active" : ""}`}
          onClick={() => setActiveSubModule("all")}
        >
          All Records ({records.length})
        </button>
        <button
          type="button"
          className={`tab ${activeSubModule === "prescription" ? "active" : ""}`}
          onClick={() => setActiveSubModule("prescription")}
        >
          💊 Prescriptions ({prescriptionCount})
        </button>
        <button
          type="button"
          className={`tab ${activeSubModule === "lab_report" ? "active" : ""}`}
          onClick={() => setActiveSubModule("lab_report")}
        >
          🔬 Lab Reports ({labReportCount})
        </button>
      </div>

      {/* Filter and Search Bar Controls */}
      <div
        className="card"
        style={{
          marginBottom: "20px",
          padding: "16px 20px",
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "260px", flexWrap: "wrap" }}>
          {/* Universal Search Input */}
          <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
            <input
              type="search"
              placeholder="Search by doctor, diagnosis, medication, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 36px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "14px",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.6,
                fontSize: "14px",
              }}
            >
              🔍
            </span>
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: "180px" }}>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "14px",
              }}
              aria-label="Filter by department"
            >
              <option value="all">🏥 All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Sorting Order */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>Sort Date:</span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            style={{ fontSize: "13px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span>{sortOrder === "newest" ? "📅 Newest First ↓" : "📅 Oldest First ↑"}</span>
          </button>
        </div>
      </div>

      {/* Main Records List / Timeline */}
      {filteredRecords.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>
            {activeSubModule === "prescription" ? "💊" : activeSubModule === "lab_report" ? "🔬" : "🩺"}
          </div>
          <h3 style={{ fontSize: "18px", color: "#f1f5f9", marginBottom: "8px" }}>
            {searchQuery || selectedDepartment !== "all"
              ? "No medical records match your filters"
              : activeSubModule === "prescription"
              ? "No prescriptions saved yet"
              : activeSubModule === "lab_report"
              ? "No diagnostic lab reports recorded yet"
              : "No health records in your vault"}
          </h3>
          <p style={{ color: "#94a3b8", maxWidth: "480px", margin: "0 auto 24px auto", fontSize: "14.5px" }}>
            {searchQuery || selectedDepartment !== "all"
              ? "Try resetting your search query or department filter to view other records."
              : "Attach doctor prescriptions, lab test reports, diagnosis summaries, and set follow-up reminders in one private place."}
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            {searchQuery || selectedDepartment !== "all" ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDepartment("all");
                  setActiveSubModule("all");
                }}
              >
                Clear Filters
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => openCreateForm("prescription")}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>💊</span> Add Prescription
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openCreateForm("lab_report")}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>🔬</span> Add Lab Report
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredRecords.map((record) => {
            const isPrescription = record.type === "prescription";
            const formattedDate = record.date
              ? new Date(record.date).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Date Not Set";

            return (
              <div
                key={record.id}
                className="card fade-in"
                style={{
                  borderLeft: isPrescription ? "4px solid #60a5fa" : "4px solid #34d399",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  className="card-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Sub-module type badge */}
                    <span
                      style={{
                        background: isPrescription ? "rgba(59, 130, 246, 0.15)" : "rgba(16, 185, 129, 0.15)",
                        color: isPrescription ? "#60a5fa" : "#34d399",
                        border: `1px solid ${isPrescription ? "rgba(59, 130, 246, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {isPrescription ? "💊 Prescription" : "🔬 Lab Report"}
                    </span>

                    {/* Department badge (defaults to General) */}
                    <span
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "#e2e8f0",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      🏥 {record.department || "General"}
                    </span>

                    {/* Date badge */}
                    <span
                      style={{
                        background: "rgba(148, 163, 184, 0.12)",
                        color: "#94a3b8",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    >
                      📅 {formattedDate}
                    </span>
                  </div>

                  {/* Actions Header */}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedRecordForDetail(record)}
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                      title="View Details & Attachments"
                    >
                      View & Files
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openEditForm(record)}
                      style={{ fontSize: "13px", padding: "6px 10px" }}
                      title="Edit Record"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDelete(record.id)}
                      style={{ fontSize: "13px", padding: "6px 10px", color: "#f87171" }}
                      title="Delete Record"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="card-body" style={{ padding: "18px 20px" }}>
                  <h3 style={{ fontSize: "17px", color: "#fff", margin: "0 0 10px 0" }}>
                    {record.title}
                  </h3>

                  {/* Doctor & Clinic */}
                  {record.doctorOrClinic && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", color: "#cbd5e1", fontSize: "14px" }}>
                      <span style={{ opacity: 0.8 }}>👨‍⚕️</span>
                      <strong>{record.doctorOrClinic}</strong>
                    </div>
                  )}

                  {/* Diagnosis */}
                  {record.diagnosis && (
                    <div style={{ marginBottom: "10px", fontSize: "14px", color: "#e2e8f0" }}>
                      <span style={{ color: "#94a3b8", fontWeight: 500 }}>Diagnosis / Panel: </span>
                      <span>{record.diagnosis}</span>
                    </div>
                  )}

                  {/* Medications or Summary Preview */}
                  {record.medicationsOrSummary && (
                    <div
                      style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        padding: "12px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        fontSize: "13.5px",
                        color: "#cbd5e1",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.5,
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#818cf8", marginBottom: "4px", fontWeight: 600 }}>
                        {isPrescription ? "Prescribed Medications & Regimen" : "Key Findings / Diagnostic Summary"}
                      </div>
                      {record.medicationsOrSummary}
                    </div>
                  )}

                  {/* Follow Up Date Banner */}
                  {record.followUpDate && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        color: "#fbbf24",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12.5px",
                        fontWeight: 500,
                      }}
                    >
                      <span>⏰</span>
                      <span>Follow-up appointment scheduled: {record.followUpDate}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          Add / Edit Record Form Modal
         ───────────────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="product-detail-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isOcrScanning) {
              setShowForm(false);
            }
          }}
        >
          <section
            className="product-detail-modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: "680px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="product-detail-header">
              <div>
                <span className="eyebrow">
                  {editingRecord ? "EDIT MEDICAL RECORD" : "NEW MEDICAL ENTRY"}
                </span>
                <h2>{editingRecord ? "Update Health Record" : "Add Prescription / Lab Report"}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowForm(false)}
                disabled={isOcrScanning}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Smart Auto-Fill (Beta) Section */}
            {!editingRecord && (
              <div
                style={{
                  margin: "16px 20px 0 20px",
                  padding: "14px 16px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <strong style={{ color: "#fff", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>✨</span> Smart Auto-Fill (Beta)
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#cbd5e1" }}>
                      Snap or select an image of your prescription/report to automatically detect date, department & medications.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      ref={ocrFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrScan(file);
                      }}
                    />
                    <input
                      ref={ocrCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleOcrScan(file);
                      }}
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isOcrScanning}
                      onClick={() => ocrFileInputRef.current?.click()}
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                    >
                      📁 Upload Scan
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={isOcrScanning}
                      onClick={() => ocrCameraInputRef.current?.click()}
                      style={{ fontSize: "13px", padding: "6px 12px" }}
                    >
                      📷 Camera Snap
                    </button>
                  </div>
                </div>

                {isOcrScanning && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>
                      <span>Analyzing medical document...</span>
                      <span>{ocrProgress}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${ocrProgress}%`,
                          height: "100%",
                          background: "#38bdf8",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSave} style={{ padding: "20px" }}>
              {/* Type Selection (Sub-module) */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "8px" }}>
                  Record Type *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "prescription" })}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: formData.type === "prescription" ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
                      background: formData.type === "prescription" ? "rgba(59, 130, 246, 0.15)" : "rgba(15, 23, 42, 0.6)",
                      color: formData.type === "prescription" ? "#93c5fd" : "#94a3b8",
                      fontWeight: 600,
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <span>💊</span> Doctor Prescription
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: "lab_report" })}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: formData.type === "lab_report" ? "2px solid #34d399" : "1px solid rgba(255,255,255,0.1)",
                      background: formData.type === "lab_report" ? "rgba(16, 185, 129, 0.15)" : "rgba(15, 23, 42, 0.6)",
                      color: formData.type === "lab_report" ? "#6ee7b7" : "#94a3b8",
                      fontWeight: 600,
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <span>🔬</span> Lab / Diagnostic Report
                  </button>
                </div>
              </div>

              {/* Date & Department Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label htmlFor="med-date" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                    Date *
                  </label>
                  <input
                    id="med-date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="med-department" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                    Department (Optional - defaults to General)
                  </label>
                  <input
                    id="med-department"
                    type="text"
                    list="dept-suggestions"
                    placeholder="General, Cardiology, etc."
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                    }}
                  />
                  <datalist id="dept-suggestions">
                    {availableDepartments.map((dept) => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Title Input */}
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="med-title" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                  Title / Reason for Visit
                </label>
                <input
                  id="med-title"
                  type="text"
                  placeholder={
                    formData.type === "prescription"
                      ? `e.g. Consultation - ${formData.department || "General"}`
                      : `e.g. Annual Blood Work - ${formData.department || "General"}`
                  }
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              {/* Doctor / Clinic / Hospital */}
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="med-doctor" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                  Doctor, Clinic, or Hospital
                </label>
                <input
                  id="med-doctor"
                  type="text"
                  placeholder="e.g. Dr. Robert Chen, City Care Clinic"
                  value={formData.doctorOrClinic || ""}
                  onChange={(e) => setFormData({ ...formData, doctorOrClinic: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              {/* Diagnosis / Symptoms / Test Panel */}
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="med-diagnosis" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                  {formData.type === "prescription" ? "Diagnosis / Symptoms" : "Test Panel / Parameter Evaluated"}
                </label>
                <input
                  id="med-diagnosis"
                  type="text"
                  placeholder={
                    formData.type === "prescription"
                      ? "e.g. Seasonal Allergic Rhinitis, High BP"
                      : "e.g. Complete Blood Count (CBC), Lipid Profile"
                  }
                  value={formData.diagnosis || ""}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                  }}
                />
              </div>

              {/* Medications or Diagnostic Findings */}
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="med-summary" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                  {formData.type === "prescription" ? "Medications, Dosages & Regimen" : "Key Lab Findings & Reference Values"}
                </label>
                <textarea
                  id="med-summary"
                  rows={4}
                  placeholder={
                    formData.type === "prescription"
                      ? "e.g.\n1. Tab Amoxicillin 500mg - 1-0-1 after food (5 days)\n2. Syp Cetirizine 10ml - 0-0-1 at bedtime"
                      : "e.g.\n- Haemoglobin: 14.2 g/dL (Normal: 13.0 - 17.0)\n- Total Cholesterol: 185 mg/dL (Desirable < 200)\n- Blood Sugar Fasting: 92 mg/dL"
                  }
                  value={formData.medicationsOrSummary || ""}
                  onChange={(e) => setFormData({ ...formData, medicationsOrSummary: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Follow-up Date & Reminder Checkbox */}
              <div
                style={{
                  padding: "14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                <label htmlFor="med-followup" style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>
                  Follow-Up Date (Optional)
                </label>
                <input
                  id="med-followup"
                  type="date"
                  value={formData.followUpDate || ""}
                  onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    marginBottom: "10px",
                  }}
                />

                {formData.followUpDate && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "#e2e8f0", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.reminderEnabled}
                      onChange={(e) => setFormData({ ...formData, reminderEnabled: e.target.checked })}
                    />
                    <span>Automatically schedule a follow-up reminder in my Vault</span>
                  </label>
                )}
              </div>

              {/* Attachment Picker for Creation */}
              <div
                style={{
                  padding: "14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px dashed rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFile(file);
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFile(file);
                  }}
                />

                <div style={{ marginBottom: "10px", fontSize: "13px", color: "#94a3b8" }}>
                  📎 Attach Prescription or Diagnostic Report (PDF or Photo)
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: "13px", padding: "8px 14px" }}
                  >
                    Select File (PDF / Image)
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{ fontSize: "13px", padding: "8px 14px" }}
                  >
                    📷 Snap Document
                  </button>
                </div>

                {pendingFile && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: "6px",
                      color: "#6ee7b7",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>✓ Ready to attach: {pendingFile.name} ({(pendingFile.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "14px" }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowForm(false)}
                  disabled={isOcrScanning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isOcrScanning}
                >
                  {editingRecord ? "Save Changes" : "Save Record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          Record Detail Modal (with AttachmentManager)
         ───────────────────────────────────────────────────────── */}
      {selectedRecordForDetail && (
        <div
          className="product-detail-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRecordForDetail(null);
            }
          }}
        >
          <section
            className="product-detail-modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: "700px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="product-detail-header">
              <div>
                <span className="eyebrow">
                  {selectedRecordForDetail.type === "prescription" ? "PRESCRIPTION DETAILS" : "LAB REPORT DETAILS"}
                </span>
                <h2>{selectedRecordForDetail.title}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedRecordForDetail(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {/* Meta Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "14px",
                  padding: "14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>RECORD TYPE</small>
                  <strong style={{ color: "#fff", fontSize: "14px" }}>
                    {selectedRecordForDetail.type === "prescription" ? "💊 Doctor Prescription" : "🔬 Lab Report"}
                  </strong>
                </div>

                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>DATE OF RECORD</small>
                  <strong style={{ color: "#fff", fontSize: "14px" }}>
                    {selectedRecordForDetail.date || "Not Set"}
                  </strong>
                </div>

                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>DEPARTMENT</small>
                  <strong style={{ color: "#38bdf8", fontSize: "14px" }}>
                    {selectedRecordForDetail.department || "General"}
                  </strong>
                </div>

                <div>
                  <small style={{ color: "#94a3b8", display: "block" }}>DOCTOR / CLINIC</small>
                  <strong style={{ color: "#fff", fontSize: "14px" }}>
                    {selectedRecordForDetail.doctorOrClinic || "Not Specified"}
                  </strong>
                </div>
              </div>

              {/* Diagnosis */}
              {selectedRecordForDetail.diagnosis && (
                <div style={{ marginBottom: "16px" }}>
                  <small style={{ color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                    {selectedRecordForDetail.type === "prescription" ? "DIAGNOSIS & SYMPTOMS" : "TEST PANEL"}
                  </small>
                  <div style={{ color: "#e2e8f0", fontSize: "15px", fontWeight: 500 }}>
                    {selectedRecordForDetail.diagnosis}
                  </div>
                </div>
              )}

              {/* Medications or Findings */}
              {selectedRecordForDetail.medicationsOrSummary && (
                <div style={{ marginBottom: "20px" }}>
                  <small style={{ color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                    {selectedRecordForDetail.type === "prescription" ? "MEDICATIONS & INSTRUCTIONS" : "DIAGNOSTIC FINDINGS"}
                  </small>
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.8)",
                      padding: "14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: "14px",
                      color: "#cbd5e1",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                    }}
                  >
                    {selectedRecordForDetail.medicationsOrSummary}
                  </div>
                </div>
              )}

              {/* Follow Up */}
              {selectedRecordForDetail.followUpDate && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    color: "#fbbf24",
                    fontSize: "13.5px",
                    marginBottom: "20px",
                  }}
                >
                  <span>⏰</span>
                  <strong>Next Follow-up Appointment: {selectedRecordForDetail.followUpDate}</strong>
                </div>
              )}

              {/* Attachments Section */}
              <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "16px" }}>
                <h4 style={{ fontSize: "15px", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>📎</span> Encrypted Document Attachments
                </h4>
                <AttachmentManager entityId={selectedRecordForDetail.id} />
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const toEdit = selectedRecordForDetail;
                    setSelectedRecordForDetail(null);
                    openEditForm(toEdit);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span>✏️</span> Edit Record
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSelectedRecordForDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default MedicalPage;
