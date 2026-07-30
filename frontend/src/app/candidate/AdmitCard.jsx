import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CalendarClock, Download, Eye, FileBadge, Loader2, MapPin, X } from 'lucide-react'
import CandidateLayout from '../../components/layouts/CandidateLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DocumentPreviewFrame from '../../components/common/DocumentPreviewFrame'
import { candidateService } from '../../services/candidate.service'

const AdmitCard = () => {
  const [previewCard, setPreviewCard] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['candidate-admit-cards'],
    queryFn: candidateService.getMyAdmitCards,
  })

  const admitCards = data?.admitCards || []

  return (
    <CandidateLayout title="Admit Card">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admit Card</h1>
          <p className="text-sm text-gray-500 mt-1">Download published admit cards for your examinations.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
            <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
          </div>
        ) : admitCards.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileBadge className="w-7 h-7 text-orange-600" />
              </div>
              <h2 className="font-semibold text-gray-900">No admit card published yet</h2>
              <p className="text-sm text-gray-500 mt-1">
                Once the commission publishes your admit card, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {admitCards.map((card) => {
              const schedule = card.examScheduleId
              const allocation = card.allocationId
              const center = allocation?.centerId
              return (
                <Card key={card._id} className="bg-white">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-bold text-gray-900">{schedule?.examName || 'Examination'}</h2>
                        <p className="text-xs text-gray-500 mt-1">{schedule?.examCode}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                        Published
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Roll Number</p>
                        <p className="font-bold text-gray-900 mt-0.5">{card.rollNumber}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Admit Card No.</p>
                        <p className="font-bold text-gray-900 mt-0.5 text-xs">{card.admitCardNumber}</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <CalendarClock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {schedule?.examDate ? new Date(schedule.examDate).toLocaleDateString('en-IN') : 'Date not set'}
                          </p>
                          <p className="text-gray-500">
                            Reporting {schedule?.reportingTime || '-'} · Exam {schedule?.examStartTime || '-'}
                            {schedule?.examEndTime ? ` to ${schedule.examEndTime}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-gray-900">{center?.name || 'Center assigned'}</p>
                          <p className="text-gray-500">
                            {[center?.city, center?.district, center?.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewCard(card)}
                        className="w-full border-gray-200 hover:border-orange-300 hover:text-orange-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <a
                        href={candidateService.getAdmitCardPdfUrl(card._id)}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {previewCard && (
        <div className="fixed inset-0 z-50 bg-gray-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">Admit Card Preview</h2>
                <p className="text-sm text-gray-500">
                  {previewCard.examScheduleId?.examName || 'Examination'} · Roll No. {previewCard.rollNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCard(null)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                aria-label="Close admit card preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 overflow-hidden">
              <DocumentPreviewFrame
                title="Admit Card Preview"
                src={candidateService.getAdmitCardHtmlUrl(previewCard._id)}
              />
            </div>
          </div>
        </div>
      )}
    </CandidateLayout>
  )
}

export default AdmitCard
