import { AdCopyParams } from "./types.js";

const STANDARD_CTAS = ["გაიგე მეტი", "მოგვწერეთ", "დარეკეთ", "დაჯავშნეთ", "რეგისტრაცია", "შეიძინეთ"];

interface PlatformSpec {
    headlineMaxChars?: number;
    bodyMinChars?: number;
    bodyMaxChars: number;
    hashtagRange: [number, number];
    styleNote: string;
    algorithmNote: string;
    avoidInlineLink?: boolean;
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
    facebook: {
        headlineMaxChars: 40,
        bodyMaxChars: 125,
        hashtagRange: [1, 2],
        styleNote: "სათაური მაქსიმუმ 40 სიმბოლო (იდეალურია 27-მდე), ტექსტი მოკლე და პირდაპირი — პირველივე 125 სიმბოლო ჩანს ჩაკეცვის გარეშე.",
        algorithmNote: "დაწერე სტრუქტურით: hook → სარგებელზე ორიენტირებული მესიჯი → სოციალური მტკიცებულება (რიცხვი/შედეგი, თუ შესაძლებელია) → პირდაპირი CTA. გამოიყენე აქტიური ენა და კონკრეტული რიცხვები ('დაზოგე 30%' სჯობს 'დაზოგე ფული'-ს), ბრენდის სახელით კი არა, სარგებლით დაიწყე.",
    },
    instagram: {
        bodyMinChars: undefined,
        bodyMaxChars: 150,
        hashtagRange: [3, 5],
        styleNote: "caption-ის hook პირველივე 125 სიმბოლოში უნდა იყოს ჩატეული. მოკლე ტექსტი (150 სიმბოლომდე) მეტ ლაიქს იღებს — თუ საჭიროა უფრო ღრმა/სთორითელინგის ტექსტი, დასაშვებია გახანგრძლივება, მაგრამ hook მაინც თავშივე უნდა ჩანდეს.",
        algorithmNote: "დღეს save და share არის მთავარი რანჟირების სიგნალი (არა მხოლოდ ლაიქი) — დაწერე ისე, რომ მკითხველს გაუჩნდეს სურვილი შეინახოს ან გაუზიაროს სხვას, და დაამატე კითხვა ან მოწვევა კომენტარისთვის. მოერიდე ხელოვნურ engagement-bait ფრაზებს ('დააკომენტარე თუ...')."
    },
    linkedin: {
        bodyMinChars: 1300,
        bodyMaxChars: 2500,
        hashtagRange: [0, 3],
        styleNote: "იდეალური სიგრძეა 1300-2500 სიმბოლო (მაქსიმუმ 3000) — ეს პლატფორმა მოკლე ტექსტს არ აჯილდოებს, გრძელი, გააზრებული პოსტი სჯობს.",
        algorithmNote: "LinkedIn-ის ალგორითმზე მთავარი სიგნალია dwell time (რამდენ ხანს კითხულობენ პოსტს) — 61+ წამიანი წაკითხვა ~13x მეტ ჩართულობას იძლევა, ვიდრე სწრაფი გადახედვა. დაწერე რეალური, გააზრებული გახსნით (მოკლე ისტორია/დაკვირვება, არა უბრალო რეკლამის ტექსტი) და აშკარად მოიწვიე დისკუსია/კომენტარისთვის. ბმული ტექსტის შუაში ნუ ჩასვამ — გარე ბმულები ~60%-ით ამცირებს გავრცელებას, დატოვე ის მხოლოდ CTA-ს დონეზე.",
        avoidInlineLink: true,
    },
    x: {
        bodyMaxChars: 150,
        hashtagRange: [0, 2],
        styleNote: "მაქსიმუმ 280 სიმბოლო (ბმულით 257), საუკეთესო შედეგი 100-150 სიმბოლოიან ტექსტს აქვს. ღირებულების არსი პირველივე 70 სიმბოლოში ჩადე.",
        algorithmNote: "პასუხი (reply) ~27x მეტად აწონდება ვიდრე ლაიქი, სრული საუბარი ~150x — დაასრულე გულწრფელი კითხვით ან მოსაზრებით, რომელიც პასუხს გამოიწვევს, არა მხოლოდ CTA-თი. გარე ბმული 50-90%-ით ამცირებს გავრცელებას — ბმული ნუ იქნება ტექსტში, დატოვე მხოლოდ CTA-ს დონეზე. ტონი დადებითი და კონსტრუქციული უნდა იყოს, არა კონფლიქტური.",
        avoidInlineLink: true,
    },
};

function formatHashtagRange([min, max]: [number, number]): string {
    if (min === 0) return `0-${max} (არასავალდებულო)`;
    if (min === max) return `ზუსტად ${min}`;
    return `${min}-${max}`;
}

export function buildAdCopyPrompt(params: AdCopyParams): string {
    const { platform, tone, projectName, projectDescription, projectLink, textPrompt, imagePrompt } = params;
    const spec = PLATFORM_SPECS[platform];

    const linkLine = spec?.avoidInlineLink
        ? `- ბმული: ${projectLink || "არ არის მითითებული"} (მხოლოდ კონტექსტისთვის — ტექსტის შუაში ნუ ჩასვამ, ეს პლატფორმა სჯის გარე ბმულებს)`
        : `- ბმული: ${projectLink || "არ არის მითითებული"}`;

    const platformGuidance = spec
        ? `\nპლატფორმის მოთხოვნები: ${spec.styleNote}\nალგორითმისთვის: ${spec.algorithmNote}\nჰეშტეგების რაოდენობა: ${formatHashtagRange(spec.hashtagRange)}.`
        : "";

    return `შენ ხარ სარეკლამო კოპირაითერი. დაწერე რეკლამის ტექსტი ქართულ ენაზე ${platform} პლატფორმისთვის, ${tone} ტონით.

პროექტის ინფორმაცია:
- სახელი: ${projectName}
- აღწერა: ${projectDescription || "არ არის მითითებული"}
${linkLine}
${platformGuidance}

${textPrompt ? `დამატებითი ინსტრუქცია: ${textPrompt}` : ""}
${imagePrompt ? `სურათის კონტექსტი: ${imagePrompt}` : ""}

მნიშვნელოვანი: პროექტის სახელი ("${projectName}") და ბმული ("${projectLink || ""}") ზუსტად ისე გამოიყენე, როგორც მოცემულია — არ თარგმნო და არ გადმოწერო ქართული ასოებით (ტრანსლიტერაცია), დატოვე ორიგინალი ლათინური/ორიგინალური დამწერლობით.

დასაშვებია მინიმალურად, ზომიერად გამოიყენო რელევანტური emoji/აიკონები (headline-ში და text-ში) რომ ტექსტი უფრო ცოცხალი იყოს — მაგრამ არ გადატვირთო, მაქსიმუმ 1-2 emoji მთელ პოსტში საკმარისია, თუ საერთოდ საჭიროა.

cta ველისთვის უპირატესობა მიანიჭე ერთ-ერთ ამ სტანდარტულ ვარიანტს, თუ კონტექსტს შეესაბამება: ${STANDARD_CTAS.join(", ")}. თუ არცერთი ზუსტად არ ერგება პროექტის კონტექსტს, დაწერე მოკლე, ბუნებრივი alternative.

დააბრუნე headline (მოკლე სათაური), text (რეკლამის ძირითადი ტექსტი), cta (მოქმედებისკენ მოწოდება) და hashtags (რელევანტური ჰეშტეგების მასივი).`;
}

export const IMAGE_ASPECT_RATIOS: Record<string, string> = {
    facebook: "1:1",
    instagram: "3:4",
    linkedin: "16:9",
    x: "16:9",
};

export const IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    facebook: { width: 1024, height: 1024 },
    instagram: { width: 1024, height: 1280 },
    linkedin: { width: 1280, height: 670 },
    x: { width: 1280, height: 720 },
};

const QUALITY_INSTRUCTION = [
    "Premium commercial photography, realistic lighting, sharp focus, high detail, clean composition, natural colors, polished advertising visual.",
    "No text, no typography, no logos, no watermark, no poster layout, no UI mockup.",
    "Leave clean negative space for social post copy outside the generated image.",
].join(" ");

export function buildImagePrompt(params: AdCopyParams): string {
    const { platform, projectName, projectDescription, imagePrompt } = params;
    const brandContext = `Project: "${projectName}". Description: ${projectDescription || "service or product"}. Platform: ${platform}.`;
    const creativeDirection = imagePrompt
        ? `Follow this user visual direction faithfully: ${imagePrompt}.`
        : "Create a professional campaign image for this project, with platform-appropriate framing and an editorial product/service photography style.";

    return `${brandContext} ${creativeDirection} ${QUALITY_INSTRUCTION}`;
}
