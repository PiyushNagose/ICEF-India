import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/layouts/AdminLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import CustomSelect from "../../components/ui/CustomSelect";
import AppDatePicker from "../../components/ui/AppDatePicker";
import JobStepProgress from "./JobStepProgress";
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  Calendar,
  Users,
  IndianRupee,
  Plus,
  X,
} from "lucide-react";

const STORAGE_KEY = "job_draft";

const JobBasicInfo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToReview = searchParams.get("returnTo") === "review";
  // Use URL param first, fall back to whatever was already saved in the draft
  const urlProjectId = searchParams.get("project");
  const savedDraft = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();
  const projectId = urlProjectId || savedDraft.projectId || null;

  const [formData, setFormData] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      return {
        jobTitle: saved.title || "",
        postCode: saved.postCode || "",
        department: saved.department || "",
        category: saved.category || "General",
        totalPosts: saved.totalPosts || "",
        reservedPosts: saved.reservedPosts || {
          sc: "",
          st: "",
          obc: "",
          ews: "",
          pwd: "",
        },
        jobType: saved.jobType || "Permanent",
        applicationFee: saved.applicationFee || {
          general: "",
          obc: "",
          scSt: "",
          ews: "",
          pwd: "",
        },
        applicationDeadline: saved.applicationDeadline
          ? saved.applicationDeadline.split("T")[0]
          : "",
        applicationStartDate: saved.applicationStartDate
          ? saved.applicationStartDate.split("T")[0]
          : "",
        correctionStartDate: saved.correctionStartDate
          ? saved.correctionStartDate.split("T")[0]
          : "",
        correctionDeadline: saved.correctionDeadline
          ? saved.correctionDeadline.split("T")[0]
          : "",
        admitCardReleaseDate: saved.admitCardReleaseDate
          ? saved.admitCardReleaseDate.split("T")[0]
          : "",
        examDate: saved.examDate ? saved.examDate.split("T")[0] : "",
        resultDate: saved.resultDate ? saved.resultDate.split("T")[0] : "",
        description: saved.description || "",
        posts: saved.posts?.length
          ? saved.posts
          : [
              {
                postCode: saved.postCode || "",
                title: saved.title || "",
                designation: saved.title || "",
                department: saved.department || "",
                category: saved.category || "General",
                vacancies: saved.totalPosts || "",
                payLevel: "",
                location: "",
              },
            ],
        postSelectionMode: saved.postSelectionMode || "single",
      };
    } catch {
      return {
        jobTitle: "",
        postCode: "",
        department: "",
        category: "General",
        totalPosts: "",
        reservedPosts: { sc: "", st: "", obc: "", ews: "", pwd: "" },
        jobType: "Permanent",
        applicationFee: { general: "", obc: "", scSt: "", ews: "", pwd: "" },
        applicationDeadline: "",
        applicationStartDate: "",
        correctionStartDate: "",
        correctionDeadline: "",
        admitCardReleaseDate: "",
        examDate: "",
        resultDate: "",
        description: "",
        posts: [
          {
            postCode: "",
            title: "",
            designation: "",
            department: "",
            category: "General",
            vacancies: "",
            payLevel: "",
            location: "",
          },
        ],
        postSelectionMode: "single",
      };
    }
  });
  const [errors, setErrors] = useState({});

  const set = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!projectId)
      e.projectId =
        "No project selected — go back to Jobs and select a project first";
    if (!formData.jobTitle.trim()) e.jobTitle = "Job title is required";
    else if (formData.jobTitle.trim().length < 3)
      e.jobTitle = "Job title must be at least 3 characters";
    if (!formData.postCode.trim()) e.postCode = "Post code is required";
    else if (formData.postCode.trim().length < 2)
      e.postCode = "Post code must be at least 2 characters";
    if (!formData.department.trim()) e.department = "Department is required";
    else if (formData.department.trim().length < 2)
      e.department = "Department must be at least 2 characters";
    formData.posts.forEach((post, index) => {
      if (!post.title?.trim())
        e[`posts.${index}.title`] = "Post title is required";
      if (!post.designation?.trim())
        e[`posts.${index}.designation`] = "Designation is required";
      if (!post.vacancies || Number(post.vacancies) < 1)
        e[`posts.${index}.vacancies`] = "Vacancies must be at least 1";
    });
    if (
      formData.posts.reduce(
        (sum, post) => sum + (Number(post.vacancies) || 0),
        0,
      ) < 1
    )
      e.totalPosts = "At least 1 vacancy is required";
    if (
      formData.applicationStartDate &&
      formData.applicationDeadline &&
      formData.applicationStartDate > formData.applicationDeadline
    ) {
      e.applicationDeadline = "Application deadline must be after application start";
    }
    if (
      formData.correctionStartDate &&
      formData.correctionDeadline &&
      formData.correctionStartDate > formData.correctionDeadline
    ) {
      e.correctionDeadline = "Correction deadline must be after correction start";
    }
    if (
      formData.applicationDeadline &&
      formData.examDate &&
      formData.applicationDeadline > formData.examDate
    ) {
      e.examDate = "Exam date must be after application deadline";
    }
    if (
      formData.admitCardReleaseDate &&
      formData.examDate &&
      formData.admitCardReleaseDate > formData.examDate
    ) {
      e.admitCardReleaseDate = "Admit card release must be on or before exam date";
    }
    if (formData.examDate && formData.resultDate && formData.examDate > formData.resultDate) {
      e.resultDate = "Result publish date must be after exam date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updatePost = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      posts: prev.posts.map((post, i) =>
        i === index ? { ...post, [field]: value } : post,
      ),
    }));
  };

  const addPost = () => {
    setFormData((prev) => ({
      ...prev,
      posts: [
        ...prev.posts,
        {
          postCode: "",
          title: "",
          designation: "",
          department: prev.department,
          category: prev.category,
          vacancies: "",
          payLevel: "",
          location: "",
        },
      ],
    }));
  };

  const removePost = (index) => {
    setFormData((prev) => ({
      ...prev,
      posts: prev.posts.filter((_, i) => i !== index),
    }));
  };

  const handleNext = () => {
    if (!validate()) return;
    const posts = formData.posts.map((post) => ({
      postCode: post.postCode?.trim() || "",
      title: post.title.trim(),
      designation: post.designation.trim(),
      department: post.department?.trim() || formData.department.trim(),
      category: post.category || formData.category,
      vacancies: Number(post.vacancies) || 0,
      payLevel: post.payLevel?.trim() || "",
      location: post.location?.trim() || "",
      status: "active",
    }));
    const totalPosts = posts.reduce((sum, post) => sum + post.vacancies, 0);
    // Save to sessionStorage
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
        projectId,
        title: formData.jobTitle.trim(),
        postCode: formData.postCode.trim(),
        department: formData.department.trim(),
        category: formData.category,
        totalPosts,
        posts,
        postSelectionMode: formData.postSelectionMode || "single",
        reservedPosts: {
          sc: Number(formData.reservedPosts.sc) || 0,
          st: Number(formData.reservedPosts.st) || 0,
          obc: Number(formData.reservedPosts.obc) || 0,
          ews: Number(formData.reservedPosts.ews) || 0,
          pwd: Number(formData.reservedPosts.pwd) || 0,
        },
        jobType: formData.jobType,
        applicationFee: {
          general: Number(formData.applicationFee.general) || 0,
          obc:
            Number(formData.applicationFee.obc) ||
            Number(formData.applicationFee.general) ||
            0,
          scSt: Number(formData.applicationFee.scSt) || 0,
          ews:
            Number(formData.applicationFee.ews) ||
            Number(formData.applicationFee.general) ||
            0,
          pwd: Number(formData.applicationFee.pwd) || 0,
        },
        applicationDeadline: formData.applicationDeadline || undefined,
        applicationStartDate: formData.applicationStartDate || undefined,
        correctionStartDate: formData.correctionStartDate || undefined,
        correctionDeadline: formData.correctionDeadline || undefined,
        admitCardReleaseDate: formData.admitCardReleaseDate || undefined,
        examDate: formData.examDate || undefined,
        resultDate: formData.resultDate || undefined,
        description: formData.description,
      }),
    );
    navigate(
      returnToReview
        ? `/admin/jobs/create/review${projectId ? `?project=${projectId}` : ""}`
        : `/admin/jobs/create/eligibility${projectId ? `?project=${projectId}` : ""}`,
    );
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors[field] ? "border-red-400" : "border-gray-300"}`;
  const postVacancyTotal = formData.posts.reduce(
    (sum, post) => sum + (Number(post.vacancies) || 0),
    0,
  );

  return (
    <AdminLayout title="Create Job - Basic Info">
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Create Advertisement / Exam
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Step 1 of 6: Advertisement, exam, and post details
            </p>
          </div>

          <JobStepProgress currentStep={1} projectId={projectId} clickable />

          {/* Project warning */}
          {!projectId && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <span className="text-red-500 font-bold text-lg leading-none">
                !
              </span>
              <div>
                <p className="text-sm font-semibold">No project selected</p>
                <p className="text-sm mt-1">
                  You must select a project before creating an advertisement. Go to{" "}
                  <button
                    onClick={() => navigate("/admin/jobs")}
                    className="underline font-medium"
                  >
                    Jobs
                  </button>{" "}
                  and click "Create Job" to pick a project first.
                </p>
              </div>
            </div>
          )}

          {projectId && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              <span className="text-green-600">✓</span>
              <span>
                Project selected: <strong>{projectId}</strong>
              </span>
            </div>
          )}

          {errors.projectId && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.projectId}
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
              <Card className="order-1 lg:col-span-2 h-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Advertisement / Exam Details
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Advertisement / Exam Title{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Assistant Professor Recruitment 2026"
                        className={inputClass("jobTitle")}
                        value={formData.jobTitle}
                        onChange={(e) => set("jobTitle", e.target.value)}
                      />
                      {errors.jobTitle && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.jobTitle}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Advertisement / Exam Code{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ADV-PHY-2026"
                        className={inputClass("postCode")}
                        value={formData.postCode}
                        onChange={(e) => set("postCode", e.target.value)}
                      />
                      {errors.postCode && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.postCode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Department of Physics"
                        className={inputClass("department")}
                        value={formData.department}
                        onChange={(e) => set("department", e.target.value)}
                      />
                      {errors.department && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.department}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <CustomSelect
                        value={formData.category}
                        onChange={(val) => set("category", val)}
                        options={[
                          { value: "General", label: "General" },
                          { value: "Technical", label: "Technical" },
                          { value: "Administrative", label: "Administrative" },
                          { value: "Teaching", label: "Teaching" },
                        ]}
                        placeholder="Select Category"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Advertisement Description
                    </label>
                    <textarea
                      rows="4"
                      placeholder="Describe the advertisement, exam, posts, responsibilities, and requirements..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={formData.description}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="order-3 lg:col-span-2 h-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Posts / Vacancies
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Vacancies
                      </label>
                      <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 font-semibold text-gray-900">
                        {postVacancyTotal.toLocaleString("en-IN")}
                      </div>
                      {errors.totalPosts && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.totalPosts}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Job Type
                      </label>
                      <CustomSelect
                        value={formData.jobType}
                        onChange={(val) => set("jobType", val)}
                        options={[
                          { value: "Permanent", label: "Permanent" },
                          { value: "Contract", label: "Contract" },
                          { value: "Temporary", label: "Temporary" },
                        ]}
                        placeholder="Select Job Type"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Candidate Post Selection
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        {
                          value: "single",
                          title: "Single post only",
                          desc: "Candidate can apply for one post in this advertisement.",
                        },
                        {
                          value: "preference",
                          title: "Multiple posts with preference",
                          desc: "Candidate can select eligible posts and rank preference order.",
                        },
                      ].map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() =>
                            set("postSelectionMode", option.value)
                          }
                          className={`text-left rounded-lg border p-3 transition-colors ${
                            formData.postSelectionMode === option.value
                              ? "border-orange-500 bg-white shadow-sm"
                              : "border-orange-100 bg-white/70 hover:border-orange-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-4 w-4 rounded-full border ${
                                formData.postSelectionMode === option.value
                                  ? "border-orange-600 bg-orange-600"
                                  : "border-gray-300"
                              }`}
                            />
                            <span className="text-sm font-semibold text-gray-900">
                              {option.title}
                            </span>
                          </div>
                          <p className="mt-1 pl-6 text-xs text-gray-600">
                            {option.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      If posts have different forms, eligibility, fee, exam, or
                      result process, create separate advertisements instead.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Post Types / Designations{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Add each post included under this advertisement/exam.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={addPost}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Post
                      </Button>
                    </div>
                    {formData.posts.map((post, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">
                            Post {index + 1}
                          </span>
                          {formData.posts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePost(index)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Post Code
                            </label>
                            <input
                              value={post.postCode || ""}
                              onChange={(e) =>
                                updatePost(index, "postCode", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="e.g. TC-01"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Post Title
                            </label>
                            <input
                              value={post.title || ""}
                              onChange={(e) =>
                                updatePost(index, "title", e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors[`posts.${index}.title`] ? "border-red-400" : "border-gray-300"}`}
                              placeholder="e.g. Ticket Collector"
                            />
                            {errors[`posts.${index}.title`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors[`posts.${index}.title`]}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Designation
                            </label>
                            <input
                              value={post.designation || ""}
                              onChange={(e) =>
                                updatePost(index, "designation", e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors[`posts.${index}.designation`] ? "border-red-400" : "border-gray-300"}`}
                              placeholder="e.g. Commercial Clerk"
                            />
                            {errors[`posts.${index}.designation`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors[`posts.${index}.designation`]}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Vacancies
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={post.vacancies || ""}
                              onChange={(e) =>
                                updatePost(index, "vacancies", e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors[`posts.${index}.vacancies`] ? "border-red-400" : "border-gray-300"}`}
                              placeholder="100"
                            />
                            {errors[`posts.${index}.vacancies`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors[`posts.${index}.vacancies`]}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Department
                            </label>
                            <input
                              value={post.department || ""}
                              onChange={(e) =>
                                updatePost(index, "department", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder={formData.department || "Department"}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Pay Level
                            </label>
                            <input
                              value={post.payLevel || ""}
                              onChange={(e) =>
                                updatePost(index, "payLevel", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="Level 5"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Location
                            </label>
                            <input
                              value={post.location || ""}
                              onChange={(e) =>
                                updatePost(index, "location", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="Zone/City"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reserved Posts
                    </label>
                    <div className="grid grid-cols-5 gap-3">
                      {["sc", "st", "obc", "ews", "pwd"].map((cat) => (
                        <div key={cat}>
                          <label className="block text-xs text-gray-500 mb-1 uppercase">
                            {cat}
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            value={formData.reservedPosts[cat]}
                            onChange={(e) =>
                              set(`reservedPosts.${cat}`, e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="order-2 h-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <IndianRupee className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Application Fees
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Set per-category fees. Leave blank = same as General.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    ["general", "General (₹)", "required"],
                    ["obc", "OBC (₹)", "leave blank = General"],
                    ["scSt", "SC / ST (₹)", "usually ₹0"],
                    ["ews", "EWS (₹)", "leave blank = General"],
                    ["pwd", "PwD (₹)", "usually ₹0"],
                  ].map(([key, label, hint]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {label}{" "}
                        <span className="text-gray-400 font-normal">
                          ({hint})
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        value={formData.applicationFee[key] ?? ""}
                        onChange={(e) =>
                          set(`applicationFee.${key}`, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="order-4 h-full">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Important Dates
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Start
                    </label>
                    <AppDatePicker
                      value={formData.applicationStartDate}
                      onChange={(val) => set("applicationStartDate", val)}
                      placeholder="Select application start"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Deadline
                    </label>
                    <AppDatePicker
                      value={formData.applicationDeadline}
                      onChange={(val) => set("applicationDeadline", val)}
                      placeholder="Select deadline"
                    />
                    {errors.applicationDeadline && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.applicationDeadline}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correction Start
                    </label>
                    <AppDatePicker
                      value={formData.correctionStartDate}
                      onChange={(val) => set("correctionStartDate", val)}
                      placeholder="Optional correction start"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correction Deadline
                    </label>
                    <AppDatePicker
                      value={formData.correctionDeadline}
                      onChange={(val) => set("correctionDeadline", val)}
                      placeholder="Optional correction deadline"
                    />
                    {errors.correctionDeadline && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.correctionDeadline}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admit Card Release
                    </label>
                    <AppDatePicker
                      value={formData.admitCardReleaseDate}
                      onChange={(val) => set("admitCardReleaseDate", val)}
                      placeholder="Visible/download from"
                    />
                    {errors.admitCardReleaseDate && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.admitCardReleaseDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tentative Exam Date
                    </label>
                    <AppDatePicker
                      value={formData.examDate}
                      onChange={(val) => set("examDate", val)}
                      placeholder="Select exam date"
                    />
                    {errors.examDate && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.examDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Result Publish Date
                    </label>
                    <AppDatePicker
                      value={formData.resultDate}
                      onChange={(val) => set("resultDate", val)}
                      placeholder="Select expected result date"
                    />
                    {errors.resultDate && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.resultDate}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
          </div>

          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <Button variant="outline" onClick={() => navigate("/admin/jobs")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Jobs
            </Button>
            <Button
              onClick={handleNext}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8"
            >
              {returnToReview ? "Save & Return to Review" : "Next: Eligibility"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default JobBasicInfo;





