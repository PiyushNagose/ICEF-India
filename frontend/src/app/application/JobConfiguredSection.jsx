import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { candidateService } from "../../services/candidate.service";
import { fieldKey, renderField, validateValue } from "./DynamicFormFields";

const normaliseValue = (field, value) => {
  if (field.type === "number") return value === "" ? "" : Number(value);
  if (field.type === "checkbox") return Boolean(value);
  return value;
};

const JobConfiguredSection = forwardRef(
  ({ app, applicationId, systemSource }, ref) => {
    const sections = useMemo(() => {
      const job = app?.jobId || app?.job || {};
      return Array.isArray(job.formSections)
        ? job.formSections.filter(
            (section) =>
              section.systemSource === systemSource &&
              Array.isArray(section.fields) &&
              section.fields.length > 0,
          )
        : [];
    }, [app, systemSource]);

    const [formData, setFormData] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
      setFormData(app?.formResponses || {});
    }, [app?._id]);

    const handleFieldChange = (section, field, value) => {
      const key = fieldKey(field);
      setFormData((prev) => ({ ...prev, [key]: normaliseValue(field, value) }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
    };

    const validate = () => {
      const nextErrors = {};
      sections.forEach((section) => {
        (section.fields || []).forEach((field) => {
          const error = validateValue(field, formData[fieldKey(field)]);
          if (error) nextErrors[fieldKey(field)] = error;
        });
      });
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    };

    const save = async () => {
      if (sections.length === 0) return true;
      if (!applicationId) {
        toast.error("Application not found");
        return false;
      }
      if (!validate()) return false;

      const allowedKeys = new Set();
      sections.forEach((section) => {
        (section.fields || []).forEach((field) => allowedKeys.add(fieldKey(field)));
      });
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([key]) => allowedKeys.has(key)),
      );
      await candidateService.saveDynamicFormResponses(applicationId, cleanFormData, {
        systemSource,
      });
      return true;
    };

    useImperativeHandle(ref, () => ({
      validateAndSave: save,
    }));

    if (sections.length === 0) return null;

    return (
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section._id || section.systemSource || section.title} className="shadow-sm">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-800">
                Additional {section.title}
              </h3>
              <p className="text-sm text-gray-500">
                Job-specific details configured by the recruiting authority.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(section.fields || []).map((field) => (
                  <div
                    key={fieldKey(field)}
                    className={field.type === "textarea" ? "md:col-span-2" : ""}
                  >
                    {renderField(section, field, formData, errors, handleFieldChange)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  },
);

JobConfiguredSection.displayName = "JobConfiguredSection";

export default JobConfiguredSection;
