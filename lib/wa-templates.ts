/** Ready-made WhatsApp messages in Tamil and English. HR picks one in the candidate panel; it opens WhatsApp with the
 *  text filled in (or sends through the WhatsApp Business API when that is switched on). */
export type WaContext = {
  name: string; post: string; branch: string; address: string; when?: string; link?: string; hr?: string;
};

export type WaTemplate = { key: string; label: string; needs?: ("when" | "link")[]; text: (c: WaContext) => string };

const sign = (c: WaContext) => `\n\nநன்றி / Thank you,\n${c.hr ? `${c.hr}, ` : ""}HR Team, Balasanka Group`;

export const WA_TEMPLATES: WaTemplate[] = [
  {
    key: "call_back", label: "Couldn't reach them",
    text: (c) => `வணக்கம் ${c.name},\n${c.branch} – ${c.post} பதவிக்கான உங்கள் விண்ணப்பம் தொடர்பாக உங்களை அழைக்க முயன்றோம். வசதியான நேரத்தில் இந்த எண்ணுக்கு அழைக்கவும்.\n\nHello ${c.name}, we tried to call you about your application for ${c.post} at ${c.branch}. Please call us back on this number when convenient.${sign(c)}`,
  },
  {
    key: "interview_invite", label: "Interview invitation", needs: ["when"],
    text: (c) => `வணக்கம் ${c.name},\n${c.post} பதவிக்கான நேர்காணலுக்கு உங்களை அழைக்கிறோம்.\nநாள் & நேரம்: ${c.when}\nஇடம்: ${c.address}\nஉங்கள் ஆதார் அட்டை மற்றும் கல்விச் சான்றிதழ்களைக் கொண்டு வரவும்.\n\nHello ${c.name}, you are invited for an interview for ${c.post}.\nDate & time: ${c.when}\nPlace: ${c.address}\nPlease bring your Aadhaar card and education certificates.${sign(c)}`,
  },
  {
    key: "interview_reminder", label: "Interview reminder (day before)", needs: ["when"],
    text: (c) => `நினைவூட்டல்: ${c.name}, உங்கள் நேர்காணல் ${c.when} அன்று ${c.branch}-இல் நடைபெறும். வர இயலாவிட்டால் தயவுசெய்து தெரிவிக்கவும்.\n\nReminder: ${c.name}, your interview is on ${c.when} at ${c.branch}. If you can't come, please let us know.${sign(c)}`,
  },
  {
    key: "offer", label: "Offer letter", needs: ["link"],
    text: (c) => `வாழ்த்துகள் ${c.name}! ${c.branch}-இல் ${c.post} பதவிக்கு நீங்கள் தேர்ந்தெடுக்கப்பட்டுள்ளீர்கள். உங்கள் பணி வாய்ப்புக் கடிதத்தைப் பார்த்து, ஏற்றுக்கொள்வதை இங்கே உறுதிப்படுத்தவும்:\n${c.link}\n\nCongratulations ${c.name}! You have been selected for ${c.post} at ${c.branch}. Please view your offer letter and accept it here:\n${c.link}${sign(c)}`,
  },
  {
    key: "onboarding", label: "Onboarding form", needs: ["link"],
    text: (c) => `வணக்கம் ${c.name}, பணியில் சேர உங்கள் விவரங்கள் மற்றும் ஆவணங்களை இந்த இணைப்பில் பதிவேற்றவும்:\n${c.link}\n\nHello ${c.name}, please fill your joining details and upload your documents here:\n${c.link}${sign(c)}`,
  },
  {
    key: "resubmit", label: "Ask to re-upload documents", needs: ["link"],
    text: (c) => `வணக்கம் ${c.name}, சில ஆவணங்கள் தெளிவாக இல்லை அல்லது விடுபட்டுள்ளன. அதே இணைப்பில் மீண்டும் பதிவேற்றவும்:\n${c.link}\n\nHello ${c.name}, some documents are missing or unclear. Please upload them again using the same link:\n${c.link}${sign(c)}`,
  },
  {
    key: "joining_reminder", label: "Joining reminder", needs: ["when"],
    text: (c) => `வணக்கம் ${c.name}, ${c.when} அன்று ${c.branch}-இல் பணியில் சேர உங்களை எதிர்பார்க்கிறோம். ஆதார், புகைப்படம் மற்றும் வங்கிக் கணக்கு விவரங்களைக் கொண்டு வரவும்.\n\nHello ${c.name}, we look forward to you joining ${c.branch} on ${c.when}. Please bring your Aadhaar, a photo and bank details.${sign(c)}`,
  },
  {
    key: "appointment", label: "Appointment letter", needs: ["link"],
    text: (c) => `வணக்கம் ${c.name}, உங்கள் பணி நியமனக் கடிதம் இங்கே:\n${c.link}\n\nHello ${c.name}, your appointment letter is here:\n${c.link}${sign(c)}`,
  },
  {
    key: "not_selected", label: "Not selected (polite)",
    text: (c) => `வணக்கம் ${c.name}, ${c.post} பதவிக்கு விண்ணப்பித்ததற்கு நன்றி. இந்த முறை உங்களைத் தேர்ந்தெடுக்க இயலவில்லை. உங்கள் விவரங்களை எதிர்கால வாய்ப்புகளுக்காக வைத்திருப்போம்.\n\nHello ${c.name}, thank you for applying for ${c.post}. We are unable to take your application forward this time. We will keep your details for future openings.${sign(c)}`,
  },
];

export const waLink = (mobile: string, text: string) => `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
