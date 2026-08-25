
const AdmitCardPreview = ({ template, scale = 1 }) => {
  const {
    baseLayout = 'standard',
    logoUrl = '',
    watermarkUrl = '',
    primaryColor = '#244a9b',
    organizationName = 'Jharkhand Staff Selection Commission',
    organizationNameLocal = 'Jharkhand Staff Selection Commission',
    documentTitle = 'Admit Card',
    sealText = 'JSSC',
    provisionalNote = 'If the information mentioned on this admit card is different from the application, the candidate must contact the commission immediately.',
    instructionHeading = 'Please read the instructions carefully before appearing for the examination.',
    photoBoxText = 'Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature',
    controllerTitle = 'Examination Controller',
  } = template || {};

  const photoBoxLines = String(photoBoxText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  // Mock candidate data used only for live template preview.
  const data = {
    commission: organizationName,
    localCommission: organizationNameLocal,
    examNo: 'Advt. No. 12/2023',
    examName: 'Combined Graduate Level Examination 2023',
    appNo: 'JSSC230012345',
    rollNo: '2345678901',
    name: 'RAJ KUMAR',
    father: 'SURESH KUMAR',
    gender: 'MALE',
    category: 'BC-I',
    dob: '15/08/1995',
    venue: 'Govt. High School, Ranchi (JH)',
    venueCode: '8201',
    schedule: 'Paper 1 (09:00 AM - 11:00 AM)',
  };

  // Styles based on baseLayout
  let containerClasses = "bg-white overflow-hidden relative text-black p-6 w-[574px] mx-auto text-xs";
  let tableClasses = "w-full border-collapse border border-gray-400 mb-4";
  let thClasses = "border border-gray-400 p-1.5 text-center font-bold text-[10px]";
  let tdClasses = "border border-gray-400 p-1.5 align-middle text-[10px]";

  if (baseLayout === 'modern') {
    containerClasses += " font-sans";
    tableClasses = "w-full border-collapse mb-4";
    thClasses = "border border-slate-300 bg-slate-50 text-slate-800 p-2 text-center font-bold text-[10px]";
    tdClasses = "border border-slate-300 p-2 text-[10px]";
  } else if (baseLayout === 'compact') {
    containerClasses = "bg-white overflow-hidden relative text-black p-4 w-[574px] mx-auto text-[9px]";
    thClasses = "border border-gray-400 p-1 text-center font-bold text-[9px]";
    tdClasses = "border border-gray-400 p-1 align-middle text-[9px]";
  }

  // Apply primary color to borders of specific layout tables if needed, or headers
  const dynamicStyle = {
    borderColor: primaryColor,
  };
  const dynamicBgStyle = {
    backgroundColor: primaryColor,
    color: '#ffffff'
  };

  return (
    <div 
      className="origin-top transition-transform duration-300 flex flex-col gap-6 items-center pb-8"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Page 1 */}
      <div 
        className={containerClasses}
        style={{
          width: '574px', 
          height: '842px', 
          boxShadow: '0 0 10px rgba(0,0,0,0.1)',
          backgroundImage: watermarkUrl ? `url(${watermarkUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-white/90 z-0"></div>

        <div className="relative z-10">
          {/* Header */}
          <div className="text-center leading-tight mb-4">
            {logoUrl ? (
              <div className="h-12 mb-2 flex justify-center">
                <img src={logoUrl} alt="Logo" className="max-h-12 object-contain" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-[10px]" 
                   style={{ 
                     border: `2px solid ${primaryColor}`, 
                     color: primaryColor, 
                     boxShadow: `inset 0 0 0 3px #fff, inset 0 0 0 5px ${primaryColor}40` 
                   }}>
                {sealText}
              </div>
            )}
            
            <div className="font-serif text-lg font-bold">{data.commission}</div>
            <div className="font-bold text-sm">{data.localCommission}</div>
            <div className="text-[10px] font-bold mt-1">{data.examNo}</div>
            <div className="text-[10px] font-bold">{data.examName}</div>
            <div className="text-xs font-bold mt-1">{documentTitle}</div>
            
            <div className="mt-2 h-8 w-48 bg-gray-900 mx-auto opacity-80 rounded-sm"></div>
          </div>

          {/* Candidate Details */}
          <table className={tableClasses} style={dynamicStyle}>
            <tbody>
              <tr>
                <th colSpan="3" className={`${thClasses} text-sm uppercase`} style={baseLayout !== 'modern' ? dynamicBgStyle : {}}>
                  Candidate's Details
                </th>
              </tr>
              <tr>
                <td className={`${tdClasses} w-1/4 font-bold`}>Application Number</td>
                <td className={`${tdClasses} font-semibold`}>{data.appNo}</td>
                <td rowSpan="8" className={`${tdClasses} w-1/4 text-center p-0 align-top`}>
                  <div className="h-20 border-b border-gray-400 flex items-center justify-center bg-gray-50">
                    <div className="w-16 h-16 bg-gray-200 rounded text-gray-400 flex items-center justify-center text-[8px]">Photo</div>
                  </div>
                  <div className="h-24 p-2 flex flex-col items-center justify-center text-[8px] font-bold leading-tight">
                    {(photoBoxLines.length ? photoBoxLines : ['Paste Photo Here']).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                  <div className="h-14 border-t border-gray-400 bg-gray-50 flex items-center justify-center">
                    <div className="w-20 h-8 bg-gray-200 rounded text-gray-400 flex items-center justify-center text-[8px]">Sign</div>
                  </div>
                </td>
              </tr>
              <tr><td className={`${tdClasses} font-bold`}>Roll Number</td><td className={tdClasses}>{data.rollNo}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Name</td><td className={tdClasses}>{data.name}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Father's Name</td><td className={tdClasses}>{data.father}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Gender</td><td className={tdClasses}>{data.gender}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Category</td><td className={tdClasses}>{data.category}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Date of Birth</td><td className={tdClasses}>{data.dob}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Disability</td><td className={tdClasses}>NO</td></tr>
            </tbody>
          </table>

          {/* Center Details */}
          <table className={tableClasses} style={dynamicStyle}>
            <tbody>
              <tr>
                <th colSpan="2" className={`${thClasses} text-sm uppercase`} style={baseLayout !== 'modern' ? dynamicBgStyle : {}}>
                  Exam Center Details
                </th>
              </tr>
              <tr><td className={`${tdClasses} w-1/4 font-bold`}>Center Code</td><td className={tdClasses}>{data.venueCode}</td></tr>
              <tr><td className={`${tdClasses} font-bold`}>Venue Address</td><td className={tdClasses}>{data.venue}</td></tr>
            </tbody>
          </table>
          
          <table className={tableClasses} style={dynamicStyle}>
             <thead>
               <tr>
                 <th className={thClasses} style={baseLayout !== 'modern' ? dynamicBgStyle : {}}>Subject / Paper</th>
                 <th className={thClasses} style={baseLayout !== 'modern' ? dynamicBgStyle : {}}>Date & Time</th>
               </tr>
             </thead>
             <tbody>
               <tr>
                 <td className={`${tdClasses} font-bold text-center`}>Paper 1 (Language)</td>
                 <td className={`${tdClasses} font-bold text-center`}>05/09/2023, 09:00 AM - 11:00 AM</td>
               </tr>
               <tr>
                 <td className={`${tdClasses} font-bold text-center`}>Paper 2 (Regional)</td>
                 <td className={`${tdClasses} font-bold text-center`}>05/09/2023, 01:00 PM - 03:00 PM</td>
               </tr>
             </tbody>
          </table>

          {provisionalNote && (
            <div className="mt-2 rounded border border-orange-200 bg-orange-50 p-2 text-[9px] font-semibold leading-snug text-orange-900">
              {provisionalNote}
            </div>
          )}

          <div className="mt-10 text-right text-[10px] font-bold">
            <div className="mb-8">Signature</div>
            <div>{controllerTitle}</div>
          </div>
        </div>
      </div>

      {/* Page 2: Instructions */}
      <div 
        className={containerClasses}
        style={{ 
          width: '574px', 
          height: '842px', 
          boxShadow: '0 0 10px rgba(0,0,0,0.1)' 
        }}
      >
        <div className="relative z-10">
          <div className="text-center font-bold text-sm mb-3 mt-4">INSTRUCTIONS FOR CANDIDATES</div>
          <p className="mb-5 text-center text-[10px] font-semibold">{instructionHeading}</p>
          <ol className="list-decimal pl-5 space-y-3 text-xs text-justify pr-2">
            {(template?.instructions ? template.instructions.split('\n').filter(l => l.trim().length > 0) : [
              "NO REQUEST FOR CHANGE IN EXAMINATION CENTRE WILL BE ENTERTAINED UNDER ANY CIRCUMSTANCES.",
              "The candidate must bring this Admit Card at the Examination Centre. No candidate will be allowed to enter without Admit Card.",
              "The candidate is also required to bring one valid identification card in original viz, Voter Identity Card, Driving License, PAN Card, Passport or Aadhaar Card etc.",
              "Candidate need to make their own travel/stay arrangement for attending this test. NO TA/DA will be provided for this TEST.",
              "No candidate will be allowed to enter the Examination Centre after the gate closing time.",
              "The candidate appearing in the entrance examination should, in his/her own interest, check their eligibility in all aspects so as to avoid disappointment at any later stage. Candidature for the examination is PROVISIONAL.",
              "Possession and use of electronic devices such as Mobile Phone, Micro Phone or any other associated accessories including Bluetooth devices, Calculator, Log Tables, Paper, Digital Diary Books etc. are strictly prohibited in the Examination Hall.",
              "Kindly refrain yourself from carrying any valuable item or bag as there will be no facility of safekeeping of your personal belongings including mobile phone/watches/Wallet etc.",
              "Friends & relatives accompanying the candidate will not be allowed in the campus.",
              "The Jharkhand Competitive Examination (Measures for Control and Prevention of Unfair Means in Recruitment) Act 2023 shall be applicable during examination process.",
              "In case of any discrepancy in the admit card, visit Commission Office after issuance of admit card.",
            ]).map((instruction, idx) => (
              <li key={idx} className="pb-1 border-b border-gray-100">{instruction}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AdmitCardPreview;

