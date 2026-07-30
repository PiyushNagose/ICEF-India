import { CheckCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

const steps = [
  { id: 1, name: 'Basic Info',    path: '/admin/jobs/create/basic-info' },
  { id: 2, name: 'Eligibility',  path: '/admin/jobs/create/eligibility' },
  { id: 3, name: 'Form Builder', path: '/admin/jobs/create/form-builder' },
  { id: 4, name: 'Documents',    path: '/admin/jobs/create/documents' },
  { id: 5, name: 'Payment',      path: '/admin/jobs/create/payment' },
  { id: 6, name: 'Review',       path: '/admin/jobs/create/review' },
]

/**
 * Shared 6-step progress stepper for the Job creation flow.
 *
 * @param {number}  currentStep  - The current active step (1-6)
 * @param {string}  [projectId]  - Optional project query param, forwarded on navigation
 * @param {boolean} [clickable]  - If true, completed steps are clickable navigation links
 */
const JobStepProgress = ({ currentStep, projectId, clickable = false }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleStepClick = (step) => {
    if (!clickable) return
    if (step.id < currentStep) {
      const params = new URLSearchParams()
      if (projectId) params.set('project', projectId)
      if (currentStep === steps.length || searchParams.get('returnTo') === 'review') {
        params.set('returnTo', 'review')
      }
      const query = params.toString()
      navigate(`${step.path}${query ? `?${query}` : ''}`)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-500">
            Step {currentStep} of {steps.length}
          </span>
          {projectId && (
            <Badge className="bg-orange-100 text-orange-800 text-xs hidden sm:inline-flex">
              Project ID: {projectId}
            </Badge>
          )}
        </div>

        {/* Steps */}
        <div className="flex items-center w-full overflow-x-auto pb-1">
          {steps.map((step, index) => {
            const isActive    = step.id === currentStep
            const isCompleted = step.id < currentStep
            const isClickable = clickable && isCompleted

            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                {/* Circle + label */}
                <button
                  onClick={() => handleStepClick(step)}
                  disabled={!isClickable}
                  className={`flex flex-col sm:flex-row items-center sm:space-x-2 group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-600 text-white shadow-sm'
                        : isActive
                        ? 'bg-orange-600 text-white shadow-md ring-4 ring-orange-100'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`hidden sm:block text-xs font-medium mt-1 sm:mt-0 whitespace-nowrap transition-colors ${
                      isCompleted
                        ? 'text-green-600'
                        : isActive
                        ? 'text-orange-600'
                        : 'text-gray-400'
                    } ${isClickable ? 'group-hover:text-orange-500' : ''}`}
                  >
                    {step.name}
                  </span>
                </button>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 sm:mx-3 min-w-[16px] rounded-full transition-colors duration-200 ease-out ${
                      isCompleted ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile: show current step name below the bar */}
        <p className="sm:hidden text-xs font-medium text-orange-600 mt-3 text-center">
          {steps[currentStep - 1]?.name}
        </p>
      </CardContent>
    </Card>
  )
}

export default JobStepProgress
