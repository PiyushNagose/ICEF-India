import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Award, Edit, Loader2, Plus, Save, Trash2, Users, X } from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { adminService } from "../../services/admin.service";
import { useAuth, isSuperAdminUser } from "../../hooks/useAuth";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";

const emptyCriterion = { label: "", male: "", female: "", value: "", unit: "", notes: "" };

const emptyForm = {
  name: "",
  description: "",
  physicalStandards: {
    required: false,
    criteria: [{ ...emptyCriterion }],
  },
  medicalStandards: {
    required: false,
    criteria: [{ ...emptyCriterion }],
  },
};

const inputCls =
  "h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100";

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeCriteria = (criteria) =>
  Array.isArray(criteria) && criteria.length ? criteria : [{ ...emptyCriterion }];

const legacyPhysicalCriteria = (standards = {}) => {
  const rows = ["height", "chest", "weight"]
    .map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      male: standards[key]?.male || "",
      female: standards[key]?.female || "",
      value: "",
      unit: key === "weight" ? "kg" : "cm",
      notes: "",
    }))
    .filter((row) => row.male || row.female);
  return rows.length ? rows : [{ ...emptyCriterion }];
};

const legacyMedicalCriteria = (standards = {}) => {
  const rows = [
    { label: "Vision", value: standards.vision || "" },
    { label: "Hearing", value: standards.hearing || "" },
    { label: "Other", value: standards.other || "" },
  ]
    .filter((row) => row.value)
    .map((row) => ({ ...emptyCriterion, ...row }));
  return rows.length ? rows : [{ ...emptyCriterion }];
};

const cleanCriteria = (criteria) =>
  criteria
    .map((item) => ({
      label: String(item.label || "").trim(),
      male: String(item.male || "").trim(),
      female: String(item.female || "").trim(),
      value: String(item.value || "").trim(),
      unit: String(item.unit || "").trim(),
      notes: String(item.notes || "").trim(),
    }))
    .filter((item) => item.label && (item.male || item.female || item.value || item.notes));

const StandardsSettings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const returnTo = searchParams.get("returnTo");
  const canReturnToEligibility = returnTo?.startsWith("/admin/jobs/create/eligibility");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(clone(emptyForm));
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, preset: null });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-standard-presets"],
    queryFn: () => adminService.getStandardPresets({ includeInactive: 1 }),
  });

  const presets = data?.presets || [];

  const resetForm = () => {
    setEditingId(null);
    setForm(clone(emptyForm));
  };

  const set = (path, value) => {
    const keys = path.split(".");
    setForm((prev) => {
      const next = clone(prev);
      let cursor = next;
      keys.slice(0, -1).forEach((key) => {
        cursor = cursor[key];
      });
      cursor[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const updateCriterion = (type, index, field, value) => {
    setForm((prev) => {
      const next = clone(prev);
      next[type].criteria[index][field] = value;
      return next;
    });
  };

  const addCriterion = (type) => {
    setForm((prev) => {
      const next = clone(prev);
      next[type].criteria.push({ ...emptyCriterion });
      return next;
    });
  };

  const removeCriterion = (type, index) => {
    setForm((prev) => {
      const next = clone(prev);
      next[type].criteria = next[type].criteria.filter((_, i) => i !== index);
      if (!next[type].criteria.length) next[type].criteria = [{ ...emptyCriterion }];
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        physicalStandards: {
          ...form.physicalStandards,
          criteria: cleanCriteria(form.physicalStandards.criteria),
        },
        medicalStandards: {
          ...form.medicalStandards,
          criteria: cleanCriteria(form.medicalStandards.criteria),
        },
      };
      return editingId
        ? adminService.updateStandardPreset(editingId, payload)
        : adminService.createStandardPreset(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Standard preset updated" : "Standard preset created");
      queryClient.invalidateQueries({ queryKey: ["admin-standard-presets"] });
      resetForm();
    },
    onError: (err) => toast.error(err.message || "Unable to save preset"),
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteStandardPreset,
    onSuccess: () => {
      toast.success("Standard preset archived");
      queryClient.invalidateQueries({ queryKey: ["admin-standard-presets"] });
    },
    onError: (err) => toast.error(err.message || "Unable to archive preset"),
  });

  const confirmDelete = () => {
    if (deleteModal.preset) {
      deleteMutation.mutate(deleteModal.preset._id);
      setDeleteModal({ isOpen: false, preset: null });
    }
  };

  const editPreset = (preset) => {
    setEditingId(preset._id);
    setForm({
      name: preset.name || "",
      description: preset.description || "",
      physicalStandards: {
        required: Boolean(preset.physicalStandards?.required),
        criteria: normalizeCriteria(
          preset.physicalStandards?.criteria?.length
            ? preset.physicalStandards.criteria
            : legacyPhysicalCriteria(preset.physicalStandards),
        ),
      },
      medicalStandards: {
        required: Boolean(preset.medicalStandards?.required),
        criteria: normalizeCriteria(
          preset.medicalStandards?.criteria?.length
            ? preset.medicalStandards.criteria
            : legacyMedicalCriteria(preset.medicalStandards),
        ),
      },
    });
  };

  const savePreset = () => {
    if (!form.name.trim()) {
      toast.error("Preset name is required");
      return;
    }
    if (form.physicalStandards.required && !cleanCriteria(form.physicalStandards.criteria).length) {
      toast.error("Add at least one physical criterion");
      return;
    }
    if (form.medicalStandards.required && !cleanCriteria(form.medicalStandards.criteria).length) {
      toast.error("Add at least one medical criterion");
      return;
    }
    saveMutation.mutate();
  };

  const renderCriteriaRows = (type, title, hint) => (
    <div className="rounded-2xl border border-orange-100 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm font-bold text-gray-900">
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-orange-600 focus:ring-orange-100"
            checked={form[type].required}
            onChange={(e) => set(`${type}.required`, e.target.checked)}
          />
          {title} Required
        </label>
        <Button variant="outline" size="sm" onClick={() => addCriterion(type)} className="h-9 border-orange-200 text-orange-700">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Row
        </Button>
      </div>
      <p className="mb-3 text-xs text-gray-500">{hint}</p>
      <div className="space-y-3">
        {form[type].criteria.map((item, index) => (
          <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-normal text-gray-400">Criterion {index + 1}</p>
              <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => removeCriterion(type, index)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <input className={`${inputCls} md:col-span-2`} placeholder="Name, e.g. Height / Vision" value={item.label} onChange={(e) => updateCriterion(type, index, "label", e.target.value)} />
              <input className={inputCls} placeholder="Male" value={item.male} onChange={(e) => updateCriterion(type, index, "male", e.target.value)} />
              <input className={inputCls} placeholder="Female" value={item.female} onChange={(e) => updateCriterion(type, index, "female", e.target.value)} />
              <input className={inputCls} placeholder="Common value" value={item.value} onChange={(e) => updateCriterion(type, index, "value", e.target.value)} />
              <input className={inputCls} placeholder="Unit" value={item.unit} onChange={(e) => updateCriterion(type, index, "unit", e.target.value)} />
            </div>
            <input className={`${inputCls} mt-3`} placeholder="Notes / condition" value={item.notes} onChange={(e) => updateCriterion(type, index, "notes", e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AdminLayout title="Standards Settings">
      <div className="min-h-full bg-[#f7f4ee] p-6">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {canReturnToEligibility && (
              <button
                type="button"
                onClick={() => navigate(returnTo)}
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Eligibility
              </button>
            )}
            <p className="mb-1 text-xs font-bold uppercase tracking-normal text-orange-500">
              Admin Settings
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Standards Settings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Create reusable physical and medical standard presets, then attach one while setting job eligibility.
            </p>
          </div>
          <Button onClick={resetForm} className="h-10 bg-orange-600 text-white hover:bg-orange-700">
            <Plus className="mr-2 h-4 w-4" />
            New Preset
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                <h2 className="font-semibold text-gray-900">
                  {editingId ? "Edit Standard Preset" : "Create Standard Preset"}
                </h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Preset Name</label>
                  <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Police Constable Standard" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short internal note" />
                </div>
              </div>

              {renderCriteriaRows("physicalStandards", "Physical Standards", "Add any physical rule such as height, weight, chest, running, tattoo, or endurance requirement.")}
              {renderCriteriaRows("medicalStandards", "Medical Standards", "Add any medical rule such as vision, color blindness, hearing, fitness certificate, or other condition.")}

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button onClick={savePreset} disabled={saveMutation.isPending} className="bg-orange-600 text-white hover:bg-orange-700">
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Preset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-orange-600" />
                <h2 className="font-semibold text-gray-900">Saved Presets</h2>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                </div>
              ) : presets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  No standards presets added yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {presets.map((preset) => {
                    const physicalCount = cleanCriteria(
                      preset.physicalStandards?.criteria?.length
                        ? preset.physicalStandards.criteria
                        : legacyPhysicalCriteria(preset.physicalStandards),
                    ).length;
                    const medicalCount = cleanCriteria(
                      preset.medicalStandards?.criteria?.length
                        ? preset.medicalStandards.criteria
                        : legacyMedicalCriteria(preset.medicalStandards),
                    ).length;
                    return (
                      <div key={preset._id} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{preset.name}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">{preset.description || `${physicalCount} physical, ${medicalCount} medical criteria`}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${preset.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {preset.active ? "Active" : "Archived"}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editPreset(preset)} className="h-8 px-3">
                            <Edit className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {preset.active && (
                            <Button variant="outline" size="sm" onClick={() => setDeleteModal({ isOpen: true, preset })} className="h-8 border-red-100 px-3 text-red-600 hover:bg-red-50">
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, preset: null })}
        onConfirm={confirmDelete}
        title="Archive Standard Preset"
        message={`Are you sure you want to archive "${deleteModal.preset?.name}"? It will no longer be available for new jobs.`}
        requireType={isSuperAdminUser(user)}
      />
    </AdminLayout>
  );
};

export default StandardsSettings;
