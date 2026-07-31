import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Button from "../ui/Button";

const DevNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);

  const routes = {
    "Public Pages": [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
      { name: "Jobs", path: "/jobs" },
      { name: "Results", path: "/results" },
      { name: "Notices", path: "/notices" },
      { name: "Admit Cards", path: "/admit-cards" },
      { name: "Downloads", path: "/downloads" },
      { name: "FAQ", path: "/faq" },
      { name: "Contact", path: "/contact" },
    ],
    "Auth Pages": [
      { name: "Candidate Login", path: "/auth/candidate-login" },
      { name: "Admin Login", path: "/auth/admin-login" },
      { name: "Employee Login", path: "/auth/employee-login" },
      { name: "Register", path: "/auth/register" },
    ],
    "Admin Pages": [
      { name: "Dashboard", path: "/admin/dashboard" },
      { name: "Projects", path: "/admin/projects" },
      { name: "Create Project", path: "/admin/projects/create" },
      { name: "Jobs", path: "/admin/jobs" },
      { name: "Applications", path: "/admin/applications" },
      { name: "Analytics", path: "/admin/analytics" },
      { name: "Support", path: "/admin/support" },
      { name: "Employees", path: "/admin/employees" },
      { name: "Roles", path: "/admin/roles" },
      { name: "Payment Settings", path: "/admin/payment-settings" },
      { name: "Razorpay Config", path: "/admin/payment-settings/razorpay" },
      { name: "Add Gateway", path: "/admin/payment-settings/add-gateway" },
    ],
    "Candidate Pages": [
      { name: "Dashboard", path: "/candidate/dashboard" },
      { name: "Profile", path: "/candidate/profile" },
      { name: "Jobs", path: "/candidate/jobs" },
      { name: "Applications", path: "/candidate/applications" },
      { name: "Documents", path: "/candidate/documents" },
      { name: "Payments", path: "/candidate/payments" },
      { name: "Admit Card", path: "/candidate/admit-card" },
      { name: "Results", path: "/candidate/results" },
      { name: "Support", path: "/candidate/support" },
      { name: "Notifications", path: "/candidate/notifications" },
    ],
    "Application Flow": [
      { name: "OTP Verification", path: "/auth/verify-otp" },
      { name: "Personal Details", path: "/application/personal-details" },
      { name: "Education", path: "/application/education" },
      { name: "Additional Info", path: "/application/additional-info" },
      { name: "Address Details", path: "/application/address" },
      { name: "Documents", path: "/application/documents" },
      { name: "Review", path: "/application/review" },
      { name: "Post Selection", path: "/application/post-selection" },
      { name: "Payment", path: "/application/payment" },
      { name: "Success", path: "/application/success" },
    ],
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
        >
          <Menu className="w-4 h-4 mr-2" />
          Dev Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Development Navigation</h2>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(routes).map(([category, links]) => (
              <div key={category}>
                <h3 className="font-medium text-gray-800 mb-3 text-sm uppercase tracking-wide">
                  {category}
                </h3>
                <div className="space-y-1">
                  {links.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            🚀 Development Mode - All screens are accessible for frontend
            development
          </p>
        </div>
      </div>
    </div>
  );
};

export default DevNavigation;
