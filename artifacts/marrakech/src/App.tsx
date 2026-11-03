import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Compass, DoorOpen, Eye, EyeOff, FileDown, Flame, Globe2, Hand, Headphones, Heart, Landmark, LockKeyhole, LogOut, Menu, MessageCircle, Minus, Music2, Pause, Play, Plus, Radio, Search, ShieldCheck, Sparkles, Users, Utensils, X } from 'lucide-react';
import {
  getGetActivePollQueryKey, getGetAdminAuthQueryKey, getGetAdminOverviewQueryKey, getGetAudienceSubmissionsQueryKey, getGetPollResultsQueryKey, getGetWordCloudQueryKey,
  getGetAdminSlidesQueryKey, getGetCurrentQuizQueryKey, getGetParticipantsQueryKey, getGetQuizQuestionsQueryKey, getGetQuizResultsQueryKey,
  getGetSessionStateQueryKey, getGetSlidesQueryKey, useAdminLogin, useAdminLogout, useAdvanceQuiz, useChangeSlide,
  useClosePoll, useCreatePoll, useCreateQuizQuestion, useDeleteQuizQuestion, useEndPresentation, useEndQuiz,
  useGetActivePoll, useGetAdminAuth, useGetAdminOverview, useGetAudienceSubmissions, useGetCurrentQuiz, useGetPollResults, useGetWordCloud,
  useGetAdminSlides, useGetParticipants, useGetQuizQuestions, useGetQuizResults, useGetSessionState, useGetSlides,
  useHealthCheck, useJoinSession, useModerateAudienceSubmission, useRemoveParticipant, useRevealQuizAnswer, useRevealQuizLeaderboard, useSetSessionActivity, useStartPresentation, useStartQuiz,
  useSubmitAudienceContribution, useSubmitPollVote, useSubmitQuizAnswer, useUpdateQuizQuestion, useUpdateSlide,
} from '@workspace/api-client-react';
import type { QuizQuestionInput, SlideUpdate } from '@workspace/api-client-react';
import { QRCodeSVG } from 'qrcode.react';
import ProjectorPage from '@/pages/projector-page';
import { AudienceLiveSlide } from '@/components/audience-live-slide';
import { PresentationControlExtras } from '@/components/presentation-control-extras';
import { QuizQuestionPicker } from '@/components/quiz-question-picker';
import './live-ui.css';
import './admin-results.css';
import './editorial-interactions.css';
import { subscribeToSession, type SessionConnectionState } from '@/lib/realtime';
import heroImage from '@/assets/marrakech-dusk.jpg';
import medinaImage from '@/assets/medina-lanes.jpg';
import courtyardImage from '@/assets/zellige-courtyard.jpg';
import tableImage from '@/assets/moroccan-table.jpg';
import craftImage from '@/assets/craft-workshop.jpg';
import squareImage from '@/assets/jemaa-square.jpg';
import gardenImage from '@/assets/atlas-garden.jpg';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
const cultureLinks = [
  { href: '/culture', label: 'A city of layers', icon: Compass },
  { href: '/history', label: 'History', icon: Clock3 },
  { href: '/architecture', label: 'Architecture', icon: Landmark },
  { href: '/food', label: 'Food & table', icon: Utensils },
  { href: '/traditions', label: 'Traditions', icon: Sparkles },
  { href: '/music-art', label: 'Music & making', icon: Music2 },
  { href: '/medina', label: 'The medina', icon: Globe2 },
  { href: '/jemaa-el-fnaa', label: 'Jemaa el-Fnaa', icon: Flame },
];
const copy: Record<string, { title: string; kicker: string; intro: string; image: string; sections: { title: string; text: string }[]; fact: string }> = {
  '/culture': { title: 'A city of many layers', kicker: 'Begin here · Marrakech', intro: 'Marrakech is not a monument to be looked at from a distance. It is a city made by movement: between mountain and plain, courtyard and street, the old and the newly imagined.', image: medinaImage, sections: [{ title: 'A meeting place', text: 'Founded in 1070–72 by the Almoravids, Marrakech became a capital and a crossroads. Its position linked the fertile Haouz plain to routes crossing the High Atlas and the Sahara.' }, { title: 'A living inheritance', text: 'The city’s historic fabric is not frozen in time. Homes, workshops, gardens, markets and places of worship remain part of daily life, continually adapted by the people who use them.' }, { title: 'Listen closely', text: 'A visit is a practice of attention: the shift from sunlit square to cool riad, the geometry of a carved doorway, the call of a vendor, the layered sound of a drum.' }], fact: 'Marrakech is one of Morocco’s four historic imperial cities, alongside Fes, Meknes and Rabat.' },
  '/history': { title: 'A capital in motion', kicker: '01 · History', intro: 'The Red City has repeatedly been made, unmade and remade by dynasties whose ambitions reached far beyond its walls.', image: gardenImage, sections: [{ title: 'Almoravid beginnings', text: 'The Almoravid movement established Marrakech in the eleventh century as a political and spiritual centre. Irrigation systems helped transform the surrounding plain into productive gardens.' }, { title: 'A city of dynasties', text: 'Almohad, Saadian and Alaouite rulers each left marks in the city: mosques, gates, palaces, gardens and institutions that reflected changing ideas of power and public life.' }, { title: 'Continuity, not a snapshot', text: 'Marrakech’s history lives in the way spaces are used. A fondouk once serving caravan trade may become a craft workshop; a courtyard home carries family memory across generations.' }], fact: 'The historic medina and its gardens were inscribed on the UNESCO World Heritage List in 1985.' },
  '/architecture': { title: 'Light, water, pattern', kicker: '02 · Architecture', intro: 'Marrakech architecture is an art of thresholds. It protects from heat, frames light and makes beauty part of the everyday.', image: courtyardImage, sections: [{ title: 'The inward-facing house', text: 'Many traditional homes turn away from the street and open inward to a courtyard. This arrangement offers privacy, shade and a calm centre for family life.' }, { title: 'A language of craft', text: 'Zellige mosaic, carved cedar, plasterwork and painted ceilings bring different materials into conversation. Repeated geometry creates rhythm without relying on a single focal point.' }, { title: 'Climate as a teacher', text: 'Thick earthen walls, shaded passages, courtyards and fountains are practical responses to heat. They also shape a particular experience of coolness, sound and movement.' }], fact: 'The ochre-red walls are made from local earth and help give Marrakech its familiar name: the Red City.' },
  '/food': { title: 'The generosity of a table', kicker: '03 · Food & table', intro: 'In Marrakech, food is inseparable from hospitality: a shared dish, a glass of mint tea, the careful balance of spice and time.', image: tableImage, sections: [{ title: 'A cuisine of exchange', text: 'Moroccan cooking brings Amazigh, Arab, Andalusian and sub-Saharan influences together. Ingredients and techniques travelled through trade, migration and family kitchens.' }, { title: 'Slow heat, layered flavour', text: 'A tagine names both a vessel and the dish cooked in it. Gentle steam softens vegetables and meat while preserved lemon, olives, herbs or warm spices build depth.' }, { title: 'A ritual of welcome', text: 'Mint tea is often poured from a height to aerate it and create a fine foam. The gesture is as meaningful as the drink: a pause, an offering, an invitation to stay.' }], fact: 'Couscous is traditionally associated with Friday gatherings, though its forms and customs vary from household to household.' },
  '/traditions': { title: 'The knowledge in a gesture', kicker: '04 · Traditions', intro: 'Tradition is not simply something inherited. It is something practised, adjusted and passed along—in a greeting, a recipe, a song or a way of making.', image: courtyardImage, sections: [{ title: 'Hospitality as practice', text: 'A welcome may begin with tea, dates or a place to rest. The details differ, but generosity is a value expressed through time and attention.' }, { title: 'Celebration and calendar', text: 'Religious festivals, weddings and seasonal gatherings bring food, dress, music and family networks into shared focus. Practices are diverse across neighbourhoods and generations.' }, { title: 'Learning by watching', text: 'Much cultural knowledge is transmitted through participation: watching an elder knead dough, learning a rhythm by ear or practising a craft beside a master.' }], fact: 'The word “riad” is related to the Arabic word for garden: a reminder of the garden as both place and idea.' },
  '/music-art': { title: 'Made by hand, carried by sound', kicker: '05 · Music & making', intro: 'The city’s workshops and musical gatherings hold different kinds of memory. One is kept in material; another disappears into the air, then returns.', image: craftImage, sections: [{ title: 'The pulse of Gnawa', text: 'Gnawa music is a spiritual and communal tradition with deep roots in sub-Saharan African histories. Its guembri, qraqeb and cyclical rhythms make music a space for memory, devotion and healing.' }, { title: 'Craft in the medina', text: 'Metalwork, leather, wood, textiles and ceramics are shaped in specialist workshops. The souk is not only a marketplace; it is a working landscape where techniques are visible.' }, { title: 'A living design vocabulary', text: 'Patterns and forms move between architecture, textiles and objects. Makers interpret inherited motifs through the materials, tools and needs of the present.' }], fact: 'Gnawa culture and music were inscribed by UNESCO as Intangible Cultural Heritage in 2019.' },
  '/medina': { title: 'A city within the city', kicker: '06 · The medina', intro: 'The medina rewards a slower pace. Its lanes are not a maze designed for visitors, but a neighbourhood shaped by daily errands, work and encounter.', image: medinaImage, sections: [{ title: 'Routes by rhythm', text: 'The old city is organised around landmarks, neighbourhood mosques, markets and streets of specialist trades. A route may follow shade, sound or the familiar face of a shopkeeper.' }, { title: 'The souks are workplaces', text: 'Behind the vivid displays are skilled processes: cutting, dyeing, hammering, stitching and finishing. Buying thoughtfully means asking about the maker, material and time involved.' }, { title: 'A place to live', text: 'Thousands of residents call the medina home. Respect for privacy, prayer, local rhythms and the people going about their day is part of a good visit.' }], fact: 'A fondouk was historically a place for merchants, animals and goods to stay while trading in the city.' },
  '/jemaa-el-fnaa': { title: 'The square that listens', kicker: '07 · Jemaa el-Fnaa', intro: 'At Jemaa el-Fnaa, the city gathers in public. The square changes through the day, becoming a stage for storytellers, musicians, food sellers and passers-by.', image: squareImage, sections: [{ title: 'A changing scene', text: 'Morning can feel spacious; evening brings food stalls, smoke, crowds and music. The square’s character shifts with light, weather, Ramadan and the rhythms of everyday life.' }, { title: 'The power of oral culture', text: 'Storytelling, poetry, jokes and music make the square a place where knowledge is shared aloud. The audience is not separate from the performance: attention gives it life.' }, { title: 'A shared public heritage', text: 'Jemaa el-Fnaa was proclaimed a UNESCO Masterpiece of the Oral and Intangible Heritage of Humanity in 2001. Its value rests in living practice, not architecture alone.' }], fact: 'The square is often translated as “assembly of the dead,” though its name and origins have several debated interpretations.' },
};

const cityTimeline = [
  { year: 'c. 1070–72', title: 'The city takes shape', text: 'The Almoravids establish Marrakech, linking the Haouz plain with routes across the High Atlas and toward the Sahara.' },
  { year: '1147', title: 'An Almohad capital', text: 'The Almohads take the city and reshape its public life, leaving an architectural legacy that includes the Koutoubia.' },
  { year: '16th century', title: 'Saadian renewal', text: 'Saadian rulers invest in gardens, palaces and religious architecture, adding new layers to the city’s built history.' },
  { year: '1912', title: 'A period of change', text: 'The establishment of the French Protectorate changes the city’s administration and urban form while the medina remains a center of daily life.' },
  { year: '1985', title: 'World Heritage recognition', text: 'The historic medina of Marrakech is inscribed on the UNESCO World Heritage List.' },
  { year: 'Today', title: 'A living city', text: 'Marrakech continues to change through the work of residents, makers, artists, families and visitors.' },
];

const landmarkCards = [
  { title: 'The medina', text: 'A living urban fabric of homes, workshops, markets and shared spaces.', href: '/medina', image: medinaImage },
  { title: 'Jemaa el-Fnaa', text: 'A public square whose rhythms shift from morning into the evening.', href: '/jemaa-el-fnaa', image: squareImage },
  { title: 'Courtyard architecture', text: 'Inward-facing spaces shaped by shade, water, privacy and craft.', href: '/architecture', image: courtyardImage },
  { title: 'Gardens and water', text: 'Cultivated landscapes that connect the city to its surrounding plain.', href: '/history', image: gardenImage },
];

const galleryItems = [
  { image: heroImage, title: 'The city at dusk', alt: 'Marrakech rooftops in the warm light of evening' },
  { image: medinaImage, title: 'A medina passage', alt: 'A narrow passage through the Marrakech medina' },
  { image: courtyardImage, title: 'Pattern and light', alt: 'Decorative zellige tilework in a courtyard' },
  { image: tableImage, title: 'At the table', alt: 'A Moroccan meal arranged for sharing' },
  { image: craftImage, title: 'Work made by hand', alt: 'A craft workshop in Marrakech' },
  { image: squareImage, title: 'The public square', alt: 'Jemaa el-Fnaa at the heart of the city' },
];

const sourcesByPath:Record<string,{label:string;url:string}[]>={
  '/culture':[
    {label:'UNESCO World Heritage Centre · Medina of Marrakesh',url:'https://whc.unesco.org/en/list/0331'},
    {label:'UNESCO Intangible Cultural Heritage · Jemaa el-Fna Square',url:'https://ich.unesco.org/en/RL/square-of-jamaa-el-fna-in-marrakech-00014'},
    {label:'UNESCO Intangible Cultural Heritage · Gnawa',url:'https://ich.unesco.org/en/RL/gnaoua-01170'},
  ],
  '/history':[{label:'UNESCO World Heritage Centre · Medina of Marrakesh',url:'https://whc.unesco.org/en/list/0331'}],
  '/medina':[{label:'UNESCO World Heritage Centre · Medina of Marrakesh',url:'https://whc.unesco.org/en/list/0331'}],
  '/jemaa-el-fnaa':[{label:'UNESCO Intangible Cultural Heritage · Jemaa el-Fna Square',url:'https://ich.unesco.org/en/RL/square-of-jamaa-el-fna-in-marrakech-00014'}],
  '/music-art':[{label:'UNESCO Intangible Cultural Heritage · Gnawa',url:'https://ich.unesco.org/en/RL/gnaoua-01170'}],
};

function CityTimeline() {
  const [selected,setSelected]=useState(0);
  const event=cityTimeline[selected];
  return <section className="city-timeline" aria-labelledby="timeline-heading">
    <div className="explorer-heading"><p className="eyebrow">A city across time</p><h2 id="timeline-heading" className="serif">More than one beginning.</h2><p>Choose a moment to see how Marrakech’s story continues to change.</p></div>
    <div className="timeline-tabs" role="tablist" aria-label="Marrakech timeline">{cityTimeline.map((item,index)=><button key={item.year} role="tab" id={`timeline-tab-${index}`} aria-selected={selected===index} aria-controls="timeline-panel" onClick={()=>setSelected(index)}>{item.year}</button>)}</div>
    <article className="timeline-panel" id="timeline-panel" role="tabpanel" aria-labelledby={`timeline-tab-${selected}`}><span className="timeline-year">{event.year}</span><div><h3 className="serif">{event.title}</h3><p>{event.text}</p></div></article>
  </section>;
}

function LandmarkExplorer() {
  return <section className="landmark-explorer" aria-labelledby="landmark-heading">
    <div className="explorer-heading"><p className="eyebrow">Places to notice</p><h2 id="landmark-heading" className="serif">Start with a place.</h2><p>Move from a single landmark into the wider stories around it.</p></div>
    <div className="landmark-grid">{landmarkCards.map((place,index)=><Link className="landmark-card" href={place.href} key={place.title}><img src={place.image} alt="" loading="lazy"/><div><span className="eyebrow">0{index+1} · EXPLORE</span><h3 className="serif">{place.title}</h3><p>{place.text}</p><span className="text-link">Open chapter <ArrowUpRight size={14}/></span></div></Link>)}</div>
  </section>;
}

function CityGallery() {
  const [active,setActive]=useState<number|null>(null);
  useEffect(()=>{
    if(active===null)return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setActive(null);
      if(event.key==='ArrowRight')setActive(index=>index===null?0:(index+1)%galleryItems.length);
      if(event.key==='ArrowLeft')setActive(index=>index===null?galleryItems.length-1:(index-1+galleryItems.length)%galleryItems.length);
    };
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[active]);
  return <section className="city-gallery" aria-labelledby="gallery-heading">
    <div className="explorer-heading"><p className="eyebrow">Field images</p><h2 id="gallery-heading" className="serif">A closer look.</h2><p>Open an image to view it in detail.</p></div>
    <div className="gallery-grid">{galleryItems.map((item,index)=><button key={item.title} className="gallery-item" onClick={()=>setActive(index)} aria-label={`Open image: ${item.title}`}><img src={item.image} alt={item.alt} loading="lazy"/><span>{item.title}</span></button>)}</div>
    {active!==null&&<div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={galleryItems[active]?.title} onClick={()=>setActive(null)}><div className="gallery-lightbox-content" onClick={event=>event.stopPropagation()}><div className="gallery-lightbox-tools"><span>{galleryItems[active]?.title}</span><button onClick={()=>setActive(null)} aria-label="Close image"><X size={20}/></button></div><img src={galleryItems[active]?.image} alt={galleryItems[active]?.alt}/><div className="gallery-lightbox-tools"><button onClick={()=>setActive(index=>index===null?galleryItems.length-1:(index-1+galleryItems.length)%galleryItems.length)} aria-label="Previous image"><ChevronLeft size={20}/> Previous</button><span>{active+1} / {galleryItems.length}</span><button onClick={()=>setActive(index=>index===null?0:(index+1)%galleryItems.length)} aria-label="Next image">Next <ChevronRight size={20}/></button></div></div></div>}
  </section>;
}

function Button({ children, onClick, kind = 'primary', disabled = false, type = 'button', className = '' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'outline' | 'danger'; disabled?: boolean; type?: 'button' | 'submit'; className?: string }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${kind} focus-ring ${className}`} data-testid="button-action">{children}</button>;
}
function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="field"><span>{label}</span><input {...props} className={`focus-ring ${props.className || ''}`} data-testid={`input-${(props.name || label).toLowerCase().replaceAll(' ','-')}`} /></label>;
}
function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [search,setSearch]=useState('');
  const matches=cultureLinks.filter(item=>`${item.label} ${copy[item.href]?.title||''} ${copy[item.href]?.intro||''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0,5);
  return <header className="site-head"><Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></Link><nav className={open ? 'top-nav open' : 'top-nav'}><Link href="/culture" onClick={() => setOpen(false)}>Explore the city</Link><Link href="/present" onClick={() => setOpen(false)}>Presenter</Link><Link href="/join" onClick={() => setOpen(false)}>Join a visit</Link><Link href="/admin" className="nav-host" onClick={() => setOpen(false)}>Host a session <ArrowUpRight size={15}/></Link></nav><button type="button" className="search-toggle" aria-label={searchOpen?'Close city search':'Search the city'} aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><Search size={18}/></button><button type="button" className="menu-button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu /></button>{searchOpen&&<div className="site-search-panel" role="search"><form onSubmit={event=>event.preventDefault()}><Search size={17}/><input autoFocus aria-label="Search chapters" placeholder="Search history, food, places…" value={search} onChange={event=>setSearch(event.target.value)} onKeyDown={event=>{if(event.key==='Escape')setSearchOpen(false);}}/><button type="button" onClick={()=>{setSearch('');setSearchOpen(false);}} aria-label="Close search"><X size={17}/></button></form><div className="site-search-results" aria-live="polite">{matches.length?matches.map(item=><Link href={item.href} key={item.href} onClick={()=>{setSearchOpen(false);setSearch('');setOpen(false);}}><span className="eyebrow">{item.label}</span><strong>{copy[item.href]?.title||item.label}</strong></Link>):<p>No chapters found. Try a place, tradition or theme.</p>}</div></div>}</header>;
}
function Footer() { return <footer className="footer"><div className="footer-top"><div className="brand brand-light"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></div><p>A guided cultural visit, wherever your classroom is.</p><Link href="/join" className="text-link">Join a live visit <ArrowRight size={15}/></Link></div><div className="footer-bottom"><span>Culture is best encountered with care.</span><span>مراكش · المغرب</span></div></footer>; }
function PageShell({ children }: { children: ReactNode }) { return <><SiteHeader/>{children}<Footer/></>; }
function LoadingBlock({ label = 'Gathering the room…' }: { label?: string }) { return <div className="loading-state" role="status"><div className="skeleton-line"/><div className="skeleton-line short"/><span>{label}</span></div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="state-panel"><CircleHelp/><h3>That didn’t arrive.</h3><p>Check your connection and try once more.</p><Button kind="outline" onClick={retry}>Try again</Button></div>; }

function HomePage() {
  const health = useHealthCheck();
  return <PageShell><main>
    <section className="hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(38,20,17,.82) 0%,rgba(50,26,22,.48) 52%,rgba(42,23,19,.08) 100%),url(${heroImage})` }}>
      <div className="hero-meta"><span>AN OPEN INVITATION</span><span className="meta-line"/><span>مراكش · MOROCCO</span></div>
      <div className="hero-copy fade-up"><p className="eyebrow light">A classroom journey through place</p><h1>Come closer<br/><em>to Marrakech.</em></h1><p className="hero-intro">A living city of red earth, quiet courtyards and a thousand small conversations. Explore it together, wherever you are.</p><div className="hero-actions"><Link href="/culture" className="btn btn-gold">Begin the visit <ArrowRight size={17}/></Link><Link href="/join" className="hero-text-link">Have a session code? <ArrowUpRight size={15}/></Link></div></div>
      <div className="hero-caption"><span>31°37′ N · 7°59′ W</span><span>THE RED CITY, SEEN SLOWLY</span></div><div className="hero-scroll"><ArrowDown size={15}/> SCROLL TO WANDER</div>
    </section>
    <section className="intro-band"><div className="intro-num">01 <span>—</span> 08</div><div className="intro-heading"><p className="eyebrow">An experience in chapters</p><h2>Not a checklist.<br/><em>A way of noticing.</em></h2></div><p className="intro-text">Move from the city’s long history to the craft of a single doorway. Follow a presenter, share what you notice, and let the story unfold at the pace of the room.</p></section>
    <section className="chapter-section"><div className="section-top"><div><p className="eyebrow">Choose your first thread</p><h2 className="serif">A city, in many voices.</h2></div><Link href="/culture" className="text-link">View all chapters <ArrowRight size={16}/></Link></div><div className="chapter-grid">{cultureLinks.slice(1,7).map((item,i)=>{const Icon=item.icon;return <Link href={item.href} className={`chapter-card chapter-${i+1}`} key={item.href}><div className="chapter-image" style={{backgroundImage:`url(${copy[item.href]?.image})`}}/><div className="chapter-overlay"/><div className="chapter-card-content"><span className="chapter-index">0{i+1}</span><Icon size={18}/><h3>{item.label}</h3><span className="chapter-arrow"><ArrowUpRight size={16}/></span></div></Link>;})}</div></section>
    <section className="live-band"><div className="live-mark"><Radio size={22}/><span>IN THE ROOM</span></div><div><p className="eyebrow light">A visit can be shared</p><h2 className="serif">One presenter.<br/><em>A whole room of perspectives.</em></h2><p>Follow along on your phone, answer a quick question, and add your own observation to the conversation.</p></div><Link href="/join" className="btn btn-gold">Join with a code <ArrowRight size={16}/></Link><div className="live-line"/></section>
    <section className="quote-section"><div className="quote-ornament">۞</div><p className="eyebrow">A note on looking</p><blockquote className="serif">“The city is never only what you see. It is also what you hear, what you share, and what you are invited to remember.”</blockquote><span className="quote-credit">A field note from the medina</span></section>
    <section className="visit-cta"><div className="visit-cta-image" style={{backgroundImage:`url(${heroImage})`}}/><div className="visit-cta-copy"><p className="eyebrow">Ready when you are</p><h2 className="serif">A little more<br/><em>than a lesson.</em></h2><p>Host a guided session for your class or join one already in progress.</p><div className="cta-row"><Link href="/admin" className="btn btn-primary">Host a visit <ArrowUpRight size={16}/></Link><Link href="/join" className="text-link">I have a code <ArrowRight size={15}/></Link></div><span className="health-note">{health.isLoading ? 'Checking connection…' : health.isError ? 'Connection status unavailable' : 'Experience ready for a live visit'}</span></div></section>
  </main></PageShell>;
}

function EditorialPage({ path }: { path: string }) {
  const data = copy[path];
  const i = cultureLinks.findIndex((link) => link.href === path);
  const next = cultureLinks[(i + 1) % cultureLinks.length];
  return <PageShell><main className="editorial">
    <div className="editorial-top"><Link href="/culture" className="back-link"><ArrowLeft size={15}/> The city, in chapters</Link><span className="eyebrow">{data.kicker}</span></div>
    <section className="editorial-hero"><div className="editorial-title"><p className="eyebrow">{data.kicker}</p><h1 className="serif">{data.title}</h1><p className="editorial-deck">{data.intro}</p></div><figure className="editorial-image"><img src={data.image} alt={`A view connected to ${data.title.toLowerCase()}`} /><figcaption>Marrakech, Morocco <span>— field notes</span></figcaption></figure></section>
    <div className="editorial-body"><aside><span className="eyebrow">IN THIS CHAPTER</span>{data.sections.map((s,n)=><a href={`#chapter-${n}`} key={s.title}><span>0{n+1}</span>{s.title}</a>)}<div className="fact-card"><Sparkles size={16}/><span className="eyebrow">A detail to keep</span><p>{data.fact}</p></div></aside><article>{data.sections.map((s,n)=><section className="prose-section" id={`chapter-${n}`} key={s.title}><span className="eyebrow">0{n+1} / FIELD NOTE</span><h2 className="serif">{s.title}</h2><p>{s.text}</p></section>)}<section className="reflection"><p className="eyebrow">PAUSE & NOTICE</p><h3 className="serif">What would you ask?</h3><p>Look again at a detail that stayed with you. What story might it hold?</p><Link className="text-link" href="/join">Share a thought in a live visit <ArrowRight size={15}/></Link></section></article></div>
    {sourcesByPath[path]?.length&&<section className="editorial-sources" aria-label="Sources and further reading"><p className="eyebrow">SOURCES & FURTHER READING</p>{sourcesByPath[path].map(source=><a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={14}/></a>)}</section>}
    {path==='/culture'&&<><CityTimeline/><LandmarkExplorer/><CityGallery/></>}
    <section className="next-chapter"><span className="eyebrow">NEXT, WANDER TOWARD</span><Link href={next.href} className="next-chapter-link"><span className="serif">{next.label}</span><ArrowRight/></Link></section>
  </main></PageShell>;
}

function SessionRealtime({ code, active = true, onEvent }: { code: string; active?: boolean; onEvent?: (event: string, payload: unknown) => void }) {
  const qc = useQueryClient();
  const onEventRef = useRef(onEvent);
  const [connection, setConnection] = useState<SessionConnectionState>('connecting');
  onEventRef.current = onEvent;
  useEffect(() => {
    if (!code || !active) {
      setConnection('disconnected');
      return;
    }
    let stop: () => void = () => {};
    let mounted = true;
    subscribeToSession(code, (event) => {
      void qc.invalidateQueries({ queryKey: getGetSessionStateQueryKey(code) });
      if (event === 'presentation:ended') return;
      void qc.invalidateQueries({ queryKey: getGetCurrentQuizQueryKey(code) });
      void qc.invalidateQueries({ queryKey: getGetActivePollQueryKey(code) });
      void qc.invalidateQueries({ queryKey: getGetParticipantsQueryKey(code) });
      void qc.invalidateQueries({ queryKey: getGetAudienceSubmissionsQueryKey(code) });
      void qc.invalidateQueries({ queryKey: getGetWordCloudQueryKey(code) });
    }, (event, payload) => onEventRef.current?.(event, payload), setConnection).then((dispose) => { if (mounted) stop = dispose; else dispose(); });
    return () => { mounted = false; stop(); };
  }, [active, code, qc]);
  return window.location.pathname.endsWith('/join') ? <AudienceLiveSlide code={code} connection={connection}/> : null;
}
function JoinPage() {
  const qrSessionCode = new URLSearchParams(window.location.search).get('session')?.trim().toUpperCase() || '';
  const savedSessionCode = localStorage.getItem('marrakech.session') || '';
  const savedNickname = localStorage.getItem('marrakech.nickname') || '';
  const [code, setCode] = useState(() => qrSessionCode || savedSessionCode);
  const [nickname, setNickname] = useState(savedNickname);
  const [joined, setJoined] = useState(Boolean(savedSessionCode && savedNickname && (!qrSessionCode || qrSessionCode === savedSessionCode.toUpperCase())));
  const [message, setMessage] = useState('');
  const join = useJoinSession();
  const qc = useQueryClient();
  const upperCode = code.trim().toUpperCase();
  const session = useGetSessionState(upperCode, { query: { enabled: joined && !!upperCode, queryKey: getGetSessionStateQueryKey(upperCode), refetchInterval: query => query.state.data?.status === 'ended' ? false : 12000 } });
  const poll = useGetActivePoll(upperCode, { query: { enabled: joined && !!upperCode && session.data?.status === 'live', queryKey: getGetActivePollQueryKey(upperCode), refetchInterval: 12000 } });
  const quiz = useGetCurrentQuiz(upperCode, { query: { enabled: joined && !!upperCode && session.data?.status === 'live', queryKey: getGetCurrentQuizQueryKey(upperCode), refetchInterval: 8000 } });
  const wordCloud = useGetWordCloud(upperCode, { query: { enabled: joined && !!upperCode && session.data?.status === 'live', queryKey: getGetWordCloudQueryKey(upperCode), refetchInterval: 15000 } });
  const vote = useSubmitPollVote();
  const answer = useSubmitQuizAnswer();
  const contribution = useSubmitAudienceContribution();
  const [pollChoice, setPollChoice] = useState<number | null>(null);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [wordText, setWordText] = useState('');
  const [questionText, setQuestionText] = useState('');
  useEffect(() => { setPollChoice(poll.data?.myOptionIndex ?? null); }, [poll.data?.poll?.id, poll.data?.myOptionIndex]);
  useEffect(() => { setQuizChoice(quiz.data?.participantAnswer?.answerIndex ?? null); }, [quiz.data?.currentQuestion?.id, quiz.data?.participantAnswer?.answerIndex]);
  if (joined) return <main className="phone-shell"><SessionRealtime code={upperCode} active={session.isLoading || session.data?.status === 'live'}/><div className="phone-top"><Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></Link><button className="icon-button" onClick={()=>{localStorage.removeItem('marrakech.session');localStorage.removeItem('marrakech.nickname');setJoined(false);}} aria-label="Leave session"><DoorOpen size={18}/></button></div><div className="phone-content"><p className="eyebrow">YOU’RE IN THE ROOM</p><h1 className="serif">Welcome,<br/><em>{nickname}.</em></h1>{session.isLoading?<LoadingBlock/>:session.isError?<ErrorState retry={()=>void session.refetch()}/>:<div className="session-card"><span className={session.data?.status === 'live' ? 'live-dot' : 'idle-dot'}/><div><span className="eyebrow">{session.data?.status === 'live'?'LIVE VISIT':'VISIT ENDED'}</span><strong>{session.data?.status === 'ended'?'This visit has ended':session.data?.currentActivity || 'Marrakech, together'}</strong><small>Chapter {session.data ? session.data.currentSlide + 1 : '—'} of {session.data?.slideCount ?? '—'}</small></div></div>}
       {session.data?.status === 'live' && (session.data.currentActivity === 'quiz' || session.data.currentActivity === 'knowledge-check') && quiz.data?.status === 'live' && quiz.data.currentQuestion && <section className="phone-activity"><span className="eyebrow">A QUICK QUESTION · {quiz.data.currentQuestion.questionNumber}/{quiz.data.currentQuestion.totalQuestions}</span><h2>{quiz.data.currentQuestion.question}</h2><div className="answer-list">{quiz.data.currentQuestion.options.map((option,index)=><button disabled={answer.isPending||Boolean(quiz.data?.participantAnswer)} className={`answer-option ${quizChoice===index?'selected':''}`} key={option} onClick={()=>{setQuizChoice(index);answer.mutate({sessionCode:upperCode,data:{questionId:quiz.data!.currentQuestion!.id,answerIndex:index}},{onSuccess:()=>{setMessage('Your answer is in. Stay with the room.');void qc.invalidateQueries({queryKey:getGetCurrentQuizQueryKey(upperCode)});}});}}>{String.fromCharCode(65+index)}<span>{option}</span>{quizChoice===index&&<Check size={17}/>}</button>)}</div>{quiz.data.participantAnswer&&<p className="success-note"><Check size={15}/>Your answer is locked in.</p>}</section>}
       {session.data?.status === 'live' && session.data.currentActivity === 'poll' && poll.data?.poll&&<section className="phone-activity"><span className="eyebrow">{poll.data.poll.status==='open'?'ROOM QUESTION':'POLL RESULTS'}</span><h2>{poll.data.poll.question}</h2>{poll.data.poll.status==='open'?<><div className="answer-list">{poll.data.poll.options.map((option,index)=><button className={`answer-option ${pollChoice===index?'selected':''}`} key={option} disabled={vote.isPending||poll.data?.myOptionIndex!==null} onClick={()=>{setPollChoice(index);vote.mutate({sessionCode:upperCode,pollId:poll.data!.poll!.id,data:{optionIndex:index}},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetActivePollQueryKey(upperCode)})});}}>{String.fromCharCode(65+index)}<span>{option}</span>{poll.data?.myOptionIndex===index&&<Check size={17}/>}</button>)}</div>{poll.data.myOptionIndex!==null&&<p className="success-note"><Check size={15}/>Your vote has been recorded.</p>}</>:<div className="poll-result-list">{poll.data.results?.map((result,index)=><div className="poll-result-row" key={result.option}><div><span>{result.option}</span><strong>{Math.round(result.percentage)}%</strong></div><div className="poll-result-track"><span style={{width:`${result.percentage}%`}}/></div><small>{result.count} {result.count===1?'vote':'votes'}</small></div>)}</div>}</section>}
       <section className="phone-activity reaction-activity"><span className="eyebrow">SEND A REACTION</span><div className="reaction-options">{[{value:'applause',label:'Applause',Icon:Hand},{value:'curiosity',label:'Curiosity',Icon:CircleHelp},{value:'wonder',label:'Wonder',Icon:Sparkles},{value:'thanks',label:'Thanks',Icon:Heart}].map(({value,label,Icon})=><button key={value} disabled={contribution.isPending||session.data?.status!=='live'} onClick={()=>contribution.mutate({sessionCode:upperCode,data:{kind:'reaction',content:value}},{onSuccess:()=>setMessage(`${label} shared with the room.`)})}><Icon size={17}/><span>{label}</span></button>)}</div></section>
       {(session.data?.status === 'live' && (session.data.currentActivity==='word-cloud' || session.data.currentActivity==='word-cloud-closed'))&&<section className="phone-activity contribution"><span className="eyebrow">{session.data.currentActivity==='word-cloud'?'WORD CLOUD · ADD YOUR WORDS':'WORD CLOUD RESULTS'}</span><h2>What does Marrakech bring to mind?</h2><p>{session.data.currentActivity==='word-cloud'?'Share one or two words. The room’s cloud updates live.':'Here are the words shared by the room.'}</p><div className="word-cloud-small">{wordCloud.data?.map(item=><span key={item.word}>{item.word}<small>{item.count}</small></span>)}</div>{session.data.currentActivity==='word-cloud'&&<><input value={wordText} onChange={e=>setWordText(e.target.value)} maxLength={60} placeholder="A word or two" data-testid="input-audience-word"/><Button disabled={!wordText.trim()||contribution.isPending} onClick={()=>contribution.mutate({sessionCode:upperCode,data:{kind:'word',content:wordText.trim()}},{onSuccess:()=>{setWordText('');setMessage('Your words are in the cloud.');void qc.invalidateQueries({queryKey:getGetWordCloudQueryKey(upperCode)});}})}>{contribution.isPending?'Sending…':'Add to the cloud'} <ArrowRight size={15}/></Button>{contribution.isError&&<p className="error-text">Could not send. Try one or two words.</p>}</>}</section>}
       <section className="phone-activity contribution"><span className="eyebrow">ASK THE PRESENTER</span><h2>What would you like to know?</h2><p>Your question goes to the presenter, not to the public room.</p><textarea value={questionText} onChange={e=>setQuestionText(e.target.value)} maxLength={240} placeholder="Ask about a place, story or detail…" data-testid="input-audience-question" disabled={session.data?.status!=='live'}/><Button disabled={!questionText.trim()||contribution.isPending||session.data?.status!=='live'} onClick={()=>contribution.mutate({sessionCode:upperCode,data:{kind:'question',content:questionText.trim()}},{onSuccess:()=>{setQuestionText('');setMessage('Your question has been sent to the presenter.');}})}>{contribution.isPending?'Sending…':'Send question'} <ArrowRight size={15}/></Button>{contribution.isError&&<p className="error-text">Could not send. Please try again.</p>}{message&&<p className="success-note"><Check size={15}/>{message}</p>}</section>
      <Link href="/quiz" className="quiz-link"><span><span className="eyebrow">WHEN THE QUIZ OPENS</span><strong>Take part on this phone</strong></span><ArrowRight size={18}/></Link>
    </div><div className="phone-foot">Session {upperCode} <span>·</span> {session.data?.participantCount ?? '—'} in the room</div></main>;
  return <main className="join-screen"><div className="join-image" style={{backgroundImage:`url(${heroImage})`}}/><div className="join-panel"><Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></Link><div className="join-form-wrap"><p className="eyebrow">COME INTO THE ROOM</p><h1 className="serif">The visit is<br/><em>better together.</em></h1><p className="muted-text">Enter the session code shared by your presenter.</p><form onSubmit={e=>{e.preventDefault();setMessage('');join.mutate({sessionCode:upperCode,data:{nickname:nickname.trim()}},{onSuccess:(result)=>{localStorage.setItem('marrakech.session',upperCode);localStorage.setItem('marrakech.nickname',nickname.trim());setJoined(true);void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(upperCode)});},onError:()=>setMessage('We couldn’t find that session. Check the code and try again.')});}}><Field label="Session code" name="session-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="MARRAKECH-12345" autoComplete="off" required maxLength={16}/><Field label="Your name for the room" name="nickname" value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="First name or nickname" required maxLength={32}/>{message&&<p className="error-text" role="alert">{message}</p>}<Button type="submit" disabled={join.isPending||!code.trim()||!nickname.trim()}>{join.isPending?'Finding your room…':'Join the visit'} <ArrowRight size={16}/></Button></form><p className="privacy-note"><ShieldCheck size={15}/> Your name is only visible to the presenter and this room.</p></div><Link href="/culture" className="text-link">Explore without a session <ArrowUpRight size={15}/></Link></div></main>;
}

function JoinQrCard({code}:{code:string}) {
  return <div className="join-qr-card">
    <QRCodeSVG value={`${window.location.origin}/join?session=${encodeURIComponent(code)}`} size={76} level="M" bgColor="#fbf7ef" fgColor="#51352b" title="Scan to join this Marrakech presentation"/>
    <span>SCAN TO JOIN</span>
    <small>{code}</small>
  </div>;
}

function PresenterPage() {
  const qc=useQueryClient();
  const auth=useGetAdminAuth({query:{queryKey:getGetAdminAuthQueryKey(),retry:false}});
  const overview=useGetAdminOverview({query:{queryKey:getGetAdminOverviewQueryKey(),refetchInterval:8000}});
  const start=useStartPresentation();
  const setActivity=useSetSessionActivity();
  const code=overview.data?.activeSession?.sessionCode || '';
  const slides=useGetSlides({query:{queryKey:getGetSlidesQueryKey()}});
  const state=useGetSessionState(code,{query:{enabled:!!code,queryKey:getGetSessionStateQueryKey(code),refetchInterval:5000}});
  const poll=useGetActivePoll(code,{query:{enabled:!!code,queryKey:getGetActivePollQueryKey(code),refetchInterval:7000}});
  const liveQuiz=useGetCurrentQuiz(code,{query:{enabled:!!code,queryKey:getGetCurrentQuizQueryKey(code),refetchInterval:5000}});
  const wordCloud=useGetWordCloud(code,{query:{enabled:!!code,queryKey:getGetWordCloudQueryKey(code),refetchInterval:12000}});
  const change=useChangeSlide(); const end=useEndPresentation();
  const [floatingReactions,setFloatingReactions]=useState<{id:string;reaction:string}[]>([]);
  const active=state.data || overview.data?.activeSession;
  const current=slides.data?.[Math.min(active?.currentSlide ?? 0,Math.max((slides.data?.length||1)-1,0))];
  const changeTo=(index:number)=>{if(!code)return;change.mutate({sessionCode:code,data:{currentSlide:index}},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(code)})});};
  const onLiveEvent=(event:string,payload:unknown)=>{
    if(event!=='audience:reaction'||!payload||typeof payload!=='object'||!('reaction' in payload)||typeof payload.reaction!=='string')return;
    const id=`${Date.now()}-${Math.random()}`;
    setFloatingReactions(items=>[...items,{id,reaction:payload.reaction as string}]);
    window.setTimeout(()=>setFloatingReactions(items=>items.filter(item=>item.id!==id)),2600);
  };
  const switchActivity=(activity:'presentation'|'word-cloud')=>setActivity.mutate({sessionCode:code,data:{activity}},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(code)})});
  if(auth.isLoading)return <main className="admin-loading"><LoadingBlock label="Opening presenter view…"/></main>;
  if(!auth.data?.authenticated)return <AdminLogin onSuccess={()=>void qc.invalidateQueries({queryKey:getGetAdminAuthQueryKey()})}/>;
  return <main className="presenter-screen">
   <SessionRealtime code={code} onEvent={onLiveEvent}/>
   <header className="presenter-top"><Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>PRESENTER STUDIO</small></span></Link><div className="presenter-status"><span className={active?.status==='live'?'live-dot':'idle-dot'}/>{active?.status==='live'?'LIVE SESSION':'READY TO BEGIN'}{active?.sessionCode&&<span className="session-badge">CODE <b>{active.sessionCode}</b></span>}</div>{active?.sessionCode&&<JoinQrCard code={active.sessionCode}/>}<Link href="/admin" className="presenter-exit"><X size={18}/><span>Exit</span></Link></header>
   <div className="presenter-layout">
    <aside className="slide-rail"><span className="eyebrow">THE VISIT</span>{slides.isLoading?<LoadingBlock label="Loading slides…"/>:slides.isError?<ErrorState retry={()=>void slides.refetch()}/>:slides.data?.map((slide,index)=><button className={`rail-slide ${active?.currentSlide===index?'current':''}`} key={slide.id} onClick={()=>changeTo(index)}><span>0{index+1}</span><div><strong>{slide.title}</strong><small>{slide.subtitle}</small></div></button>)}</aside>
    <section className="presenter-stage">
     {!active?.sessionCode?<div className="stage-empty"><div className="stage-sun">۞</div><p className="eyebrow">YOUR STORY, SHARED</p><h1 className="serif">Begin the<br/><em>Red City visit.</em></h1><p>Open a room for your audience and guide the journey slide by slide.</p><Button onClick={()=>start.mutate(undefined,{onSuccess:(s)=>{localStorage.setItem('marrakech.session',s.sessionCode);void qc.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()});}})} disabled={start.isPending}>{start.isPending?'Opening the room…':'Start presentation'} <Play size={16}/></Button>{start.isError&&<p className="error-text">The room could not be started. Try again.</p>}</div>:<>
      <div className="stage-topline"><span><span className="live-dot"/> AUDIENCE CONNECTED</span><span>{active.participantCount} {active.participantCount===1?'person':'people'} in the room</span></div>
      {active.currentActivity==='word-cloud'?<section className="word-cloud-stage"><p className="eyebrow">THE ROOM’S WORDS · {wordCloud.data?.reduce((total,item)=>total+item.count,0)||0} SHARED</p><h1 className="serif">Marrakech, <em>in your words.</em></h1><div className="word-cloud-large">{wordCloud.data?.map((item,index)=><span className={`word-cloud-item cloud-tone-${index%4}`} key={item.word} style={{fontSize:`${Math.min(56,25+item.count*5)}px`}}>{item.word}</span>)}</div>{!wordCloud.data?.length&&<p className="muted-text">Waiting for the room’s first words…</p>}</section>
       :active.currentActivity==='poll'&&poll.data?.poll?<section className="projector-activity"><p className="eyebrow">ROOM PULSE · {poll.data.poll.status==='open'?'VOTING OPEN':'RESULTS'}</p><h1 className="serif">{poll.data.poll.question}</h1>{poll.data.results?.length?<div className="projector-poll-results">{poll.data.results.map(result=><div className="projector-poll-row" key={result.option}><div><span>{result.option}</span><strong>{Math.round(result.percentage)}%</strong></div><div className="poll-result-track"><span style={{width:`${result.percentage}%`}}/></div></div>)}</div>:<div className="projector-poll-wait"><Radio size={22}/><span>{poll.data.poll.voteCount} votes received</span></div>}</section>
       :active.currentActivity==='quiz'&&liveQuiz.data?.currentQuestion?<section className="projector-activity projector-quiz"><p className="eyebrow">QUIZ · QUESTION {liveQuiz.data.currentQuestion.questionNumber} OF {liveQuiz.data.currentQuestion.totalQuestions}</p><h1 className="serif">{liveQuiz.data.currentQuestion.question}</h1><div className="projector-quiz-options">{liveQuiz.data.currentQuestion.options.map((option,index)=><div className={liveQuiz.data?.revealed&&liveQuiz.data.correctIndex===index?'correct':''} key={option}><b>{String.fromCharCode(65+index)}</b><span>{option}</span>{liveQuiz.data?.revealed&&liveQuiz.data.correctIndex===index&&<Check size={19}/>}</div>)}</div>{liveQuiz.data.revealed&&<p className="projector-reveal">{liveQuiz.data.explanation}</p>}</section>
       :<div className="slide-canvas"><div className="slide-pattern"/><span className="slide-chapter">MARRAKECH · {String((active.currentSlide??0)+1).padStart(2,'0')}</span><div className="slide-center"><p className="eyebrow">THE RED CITY EXPERIENCE</p><h1 className="serif">{current?.title||'A city of many layers'}</h1><h2>{current?.subtitle||'History, held in the everyday'}</h2><div className="slide-rule"/><p>{current?.content||'A shared journey through place, memory and making.'}</p></div><span className="slide-ornament">۞</span><span className="slide-foot">MARRAKECH · MOROCCO</span></div>}
      <div className="room-reactions" aria-live="polite">{floatingReactions.map(item=><div className="room-reaction" key={item.id}><Sparkles size={17}/>{item.reaction}</div>)}</div>
      <div className="present-controls"><div className="control-count">{String((active.currentSlide??0)+1).padStart(2,'0')} <span>/ {String(active.slideCount).padStart(2,'0')}</span></div><div className="control-buttons"><Button kind="outline" onClick={()=>changeTo(Math.max((active.currentSlide??0)-1,0))} disabled={change.isPending||(active.currentSlide??0)<=0}><ChevronLeft/></Button><Button onClick={()=>changeTo(Math.min((active.currentSlide??0)+1,active.slideCount-1))} disabled={change.isPending||(active.currentSlide??0)>=active.slideCount-1}>Next chapter <ChevronRight/></Button></div>{active.currentActivity==='word-cloud'?<Button kind="outline" onClick={()=>switchActivity('presentation')} disabled={setActivity.isPending}>Return to chapters</Button>:(!active.currentActivity||active.currentActivity==='presentation')&&<Button kind="outline" onClick={()=>switchActivity('word-cloud')} disabled={setActivity.isPending}>Open word cloud <Sparkles size={15}/></Button>}<Button kind="danger" onClick={()=>{if(confirm('End this visit for everyone?'))end.mutate({sessionCode:code},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()})});}} disabled={end.isPending}>End visit</Button></div>
      {(state.isLoading||state.isError)&&<div className="inline-state">{state.isLoading?'Reconnecting to the room…':'Live state could not be refreshed.'}</div>}
     </>}
    </section>
   </div>
  </main>;
}

function QuizPage() {
  const code=localStorage.getItem('marrakech.session')||'';
  const quiz=useGetCurrentQuiz(code,{query:{enabled:!!code,queryKey:getGetCurrentQuizQueryKey(code),refetchInterval:4000}});
  const answer=useSubmitQuizAnswer();
  const [choice,setChoice]=useState<number|null>(null);
  const [answerResult,setAnswerResult]=useState<'accepted'|'locked'|null>(null);
  const [secondsLeft,setSecondsLeft]=useState<number|null>(null);
  const q=quiz.data?.currentQuestion;
  const deadline=q?.deadline;
  const serverNow=quiz.data?.serverNow;
  const submitted=answerResult==='accepted'||Boolean(quiz.data?.participantAnswer);
  const expired=Boolean(deadline&&secondsLeft===0);
  const nickname=localStorage.getItem('marrakech.nickname')||'';
  const personalStanding=quiz.data?.leaderboard?.find(item=>item.nickname===nickname);
  useEffect(()=>{setChoice(quiz.data?.participantAnswer?.answerIndex??null);setAnswerResult(null);},[q?.id,quiz.data?.participantAnswer?.answerIndex]);
  useEffect(()=>{
    if(!deadline){setSecondsLeft(null);return;}
    const offset=serverNow?Date.parse(serverNow)-Date.now():0;
    const update=()=>setSecondsLeft(Math.max(0,Math.ceil((Date.parse(deadline)-(Date.now()+offset))/1000)));
    update();
    const interval=window.setInterval(update,250);
    return()=>window.clearInterval(interval);
  },[deadline,serverNow]);
  if(!code)return <main className="quiz-phone"><Link href="/join" className="back-link"><ArrowLeft size={15}/> Join a visit first</Link><div className="quiz-intro"><span className="quiz-badge">MARRAKECH · IN THE ROOM</span><h1 className="serif">Your seat<br/><em>is waiting.</em></h1><p>Join a live visit to take part in the room’s quiz.</p><Link href="/join" className="btn btn-primary">Enter session code <ArrowRight size={16}/></Link></div></main>;
  return <main className="quiz-phone"><SessionRealtime code={code}/><div className="quiz-header"><Link href="/join" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>ROOM QUIZ</small></span></Link><span className="quiz-live"><span className="live-dot"/> LIVE</span></div>{quiz.isLoading?<LoadingBlock label="Waiting for the next question…"/>:quiz.isError?<ErrorState retry={()=>void quiz.refetch()}/>:quiz.data?.status==='ended'?<div className="quiz-intro"><span className="quiz-badge">THAT’S A WRAP</span><h1 className="serif">Well<br/><em>noticed.</em></h1>{quiz.data.leaderboardRevealed&&personalStanding?<p>Your final score: <strong>{personalStanding.score} points</strong> · {personalStanding.correctCount} correct.</p>:<p>The room has finished the quiz. The presenter will share final scores when ready.</p>}<Link href="/leaderboard" className="btn btn-primary">View room results <ArrowRight size={16}/></Link></div>:!q?<div className="quiz-intro"><span className="quiz-badge">BETWEEN CHAPTERS</span><h1 className="serif">Stay<br/><em>curious.</em></h1><p>The presenter will open the next question shortly. Keep this page nearby.</p><div className="waiting-pulse"><span/><span/><span/></div></div>:<div className="quiz-question"><span className="quiz-badge">QUESTION {q.questionNumber} <i/> {q.totalQuestions}</span><div className="quiz-progress"><span style={{width:`${q.questionNumber/q.totalQuestions*100}%`}}/></div><h1 className="serif">{q.question}</h1><p className="quiz-points" style={{display:'flex',alignItems:'center',gap:7}}><Clock3 size={14}/>{deadline?secondsLeft===null?'Syncing timer…':`${secondsLeft}s left · ${q.points} points`:`No timer · ${q.points} points`}</p><div className="quiz-choices">{q.options.map((option,index)=><button key={option} className={`quiz-choice ${choice===index?'selected':''}`} disabled={submitted||answer.isPending||expired} onClick={()=>setChoice(index)}><b>{String.fromCharCode(65+index)}</b><span>{option}</span>{choice===index&&<Check size={17}/>}</button>)}</div>{submitted?<div className="submitted-card"><Check size={16}/> Answer locked in. Watch for the reveal.</div>:answerResult==='locked'?<div className="state-panel"><LockKeyhole/><h3>This question is closed.</h3><p>Wait for the next question.</p></div>:expired?<div className="state-panel"><Clock3/><h3>Time is up.</h3><p>Your answer was not recorded. Wait for the presenter’s reveal.</p></div>:<Button disabled={choice===null||answer.isPending||expired} onClick={()=>answer.mutate({sessionCode:code,data:{questionId:q.id,answerIndex:choice!}},{onSuccess:(result)=>setAnswerResult(result.accepted?'accepted':result.locked?'locked':null)})}>{answer.isPending?'Sending answer…':'Lock in answer'} <ArrowRight size={16}/></Button>}{quiz.data?.revealed&&quiz.data.correctIndex!=null&&<div className="answer-reveal"><Eye size={16}/><p><strong>{quiz.data.participantAnswer?(quiz.data.participantAnswer.answerIndex===quiz.data.correctIndex?'Your answer was correct.':'Not quite this time.'):'No answer was locked in.'}</strong><br/>Correct answer: {q.options[quiz.data.correctIndex]}.{quiz.data.explanation&&<> {quiz.data.explanation}</>}</p></div>}{answer.isError&&<p className="error-text">Could not submit your answer. Check your connection and try again.</p>}</div>}<div className="quiz-footer"><span>SESSION {code}</span><Link href="/leaderboard">Room standings <ArrowUpRight size={14}/></Link></div></main>;
}

function LeaderboardPage() {
 const code=localStorage.getItem('marrakech.session')||''; const query=useGetCurrentQuiz(code,{query:{enabled:!!code,queryKey:getGetCurrentQuizQueryKey(code),refetchInterval:6000}}); const revealed=Boolean(query.data?.leaderboardRevealed);
  return <main className="leaderboard-screen"><Link href="/quiz" className="back-link"><ArrowLeft size={15}/> Back to the visit</Link><div className="leaderboard-wrap"><span className="eyebrow">MARRAKECH · ROOM STANDINGS</span><h1 className="serif">What the room<br/><em>remembered.</em></h1>{query.isLoading?<LoadingBlock/>:query.isError?<ErrorState retry={()=>void query.refetch()}/>:!revealed?<div className="state-panel"><LockKeyhole/><h3>Standings stay with the room.</h3><p>The presenter will share the final scores when the quiz is over.</p><Link href="/quiz" className="text-link">Return to the quiz <ArrowRight size={15}/></Link></div>:query.data?.leaderboard?.length?<div className="leader-list">{query.data.leaderboard.map((item,i)=><div className={`leader-row rank-${i+1}`} key={`${item.nickname}-${i}`}><span className="rank">{String(i+1).padStart(2,'0')}</span><span className="avatar-initial">{item.nickname.slice(0,1).toUpperCase()}</span><strong>{item.nickname}</strong><span className="leader-correct">{item.correctCount} correct</span><b>{item.score}<small> pts</small></b></div>)}</div>:<div className="state-panel"><Users/><h3>No standings yet.</h3><p>When the room’s first answers arrive, they’ll appear here.</p></div>}<Link href="/culture" className="text-link">Keep exploring the city <ArrowRight size={15}/></Link></div></main>;
}

const adminLinks=[['/admin','Overview'],['/admin/presentation','Presentation'],['/admin/participants','Participants'],['/admin/quiz','Quiz studio'],['/admin/results','Results'],['/admin/content','Edit content']];
function AdminFrame({children,active}:{children:ReactNode;active:string}) {
 const auth=useGetAdminAuth({query:{queryKey:getGetAdminAuthQueryKey(),retry:false}});
 const logout=useAdminLogout(); const qc=useQueryClient();
 if(auth.isLoading)return <main className="admin-loading"><LoadingBlock label="Opening presenter studio…"/></main>;
 if(!auth.data?.authenticated)return <AdminLogin onSuccess={()=>void qc.invalidateQueries({queryKey:getGetAdminAuthQueryKey()})}/>;
 return <div className="admin-shell"><aside className="admin-sidebar"><Link href="/" className="brand brand-light"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>HOST STUDIO</small></span></Link><div className="sidebar-label">THE EXPERIENCE</div><nav>{adminLinks.map(([href,label],index)=><Link href={href} key={href} className={active===href?'active':''}><span className="sidebar-index">0{index+1}</span>{label}</Link>)}</nav><div className="sidebar-bottom"><div className="admin-avatar">م</div><div><strong>{auth.data.username||'Presenter'}</strong><small>SESSION HOST</small></div><button aria-label="Sign out" onClick={()=>logout.mutate(undefined,{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAdminAuthQueryKey()})})}><LogOut size={16}/></button></div></aside><main className="admin-main"><header className="admin-mobile-head"><Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>HOST STUDIO</small></span></Link><button onClick={()=>logout.mutate(undefined,{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAdminAuthQueryKey()})})}><LogOut size={16}/></button></header><nav className="admin-mobile-nav">{adminLinks.map(([href,label])=><Link href={href} key={href} className={active===href?'active':''}>{label}</Link>)}</nav>{children}</main></div>;
}
function AdminLogin({onSuccess}:{onSuccess:()=>void}) {
 const login=useAdminLogin(); const [username,setUsername]=useState(''); const [password,setPassword]=useState('');
 return <main className="admin-login"><div className="admin-login-art" style={{backgroundImage:`url(${heroImage})`}}><Link href="/" className="brand brand-light"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></Link><div><p className="eyebrow light">A good visit begins with a welcome.</p><h1 className="serif">Your room<br/><em>is ready.</em></h1><p>Presenter access for the Marrakech cultural experience.</p></div><span className="login-coord">31°37′ N · 7°59′ W</span></div><section className="login-form-panel"><p className="eyebrow">PRESENTER SIGN IN</p><h2 className="serif">Welcome back.</h2><p className="muted-text">Sign in to guide your next visit.</p><form onSubmit={e=>{e.preventDefault();login.mutate({data:{username,password}},{onSuccess:onSuccess});}}><Field label="Username" name="username" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required/><Field label="Password" name="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/><Button type="submit" disabled={login.isPending}>{login.isPending?'Signing in…':'Open presenter studio'} <ArrowRight size={16}/></Button>{login.isError&&<p className="error-text" role="alert">Those sign-in details were not accepted. Please try again.</p>}</form><p className="privacy-note"><LockKeyhole size={14}/> Private presenter access</p></section></main>;
}
function AdminOverviewPage() {
 const overview=useGetAdminOverview({query:{queryKey:getGetAdminOverviewQueryKey(),refetchInterval:10000}});
 return <AdminFrame active="/admin"><div className="admin-page-heading"><div><p className="eyebrow">GOOD TO SEE YOU</p><h1 className="serif">The room, at a glance.</h1><p>Set up a visit, welcome your audience, and keep the story moving.</p></div><Link href="/admin/presentation" className="btn btn-primary">Open presentation <ArrowRight size={16}/></Link></div>{overview.isLoading?<LoadingBlock/>:overview.isError?<ErrorState retry={()=>void overview.refetch()}/>:<><div className="overview-feature"><div className="overview-copy"><span className="eyebrow">{overview.data?.activeSession?.status==='live'?'A VISIT IS LIVE':'YOUR NEXT VISIT'}</span><h2 className="serif">{overview.data?.activeSession?'Continue the room.':'Ready to begin?'}</h2><p>{overview.data?.activeSession?`Session ${overview.data.activeSession.sessionCode} is open. ${overview.data.activeSession.participantCount} people have joined.`:'Start a guided presentation and invite your audience to join from their phones.'}</p><Link href="/admin/presentation" className="text-link">{overview.data?.activeSession?'Return to presenter view':'Set up a session'} <ArrowRight size={15}/></Link></div><div className="overview-seal">۞<small>THE RED<br/>CITY</small></div></div><div className="admin-stat-grid"><div className="admin-stat"><span className="eyebrow">ACTIVE SESSION</span><b>{overview.data?.activeSession?.sessionCode||'—'}</b><small>{overview.data?.activeSession?.status||'No open room'}</small></div><div className="admin-stat"><span className="eyebrow">QUESTION BANK</span><b>{overview.data?.questionCount??'—'}</b><small>Ready for a live quiz</small></div><div className="admin-stat"><span className="eyebrow">VISITS HOSTED</span><b>{overview.data?.totalSessions??'—'}</b><small>Across this experience</small></div></div><div className="quick-actions"><p className="eyebrow">QUICK PATHS</p>{adminLinks.slice(1).map(([href,label],i)=><Link href={href} key={href}><span>0{i+1}</span><strong>{label}</strong><ArrowUpRight size={16}/></Link>)}</div></>}</AdminFrame>;
}
function AdminPresentationPage() {
 const qc=useQueryClient();
 const overview=useGetAdminOverview({query:{queryKey:getGetAdminOverviewQueryKey(),refetchInterval:8000}});
 const start=useStartPresentation();
 const end=useEndPresentation();
 const code=overview.data?.activeSession?.sessionCode||'';
 const state=useGetSessionState(code,{query:{enabled:!!code,queryKey:getGetSessionStateQueryKey(code),refetchInterval:5000}});
 const slides=useGetSlides({query:{queryKey:getGetSlidesQueryKey()}});
 const change=useChangeSlide();
 const s=state.data||overview.data?.activeSession;
 const move=(n:number)=>change.mutate({sessionCode:code,data:{currentSlide:n}},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(code)})});
 return <AdminFrame active="/admin/presentation">
  <AdminTitle eyebrow="LIVE CONTROL" title="Guide the visit." desc="The audience sees the chapter. You keep the pace."/>
  <SessionRealtime code={code}/>
  {overview.isLoading?<LoadingBlock/>:overview.isError?<ErrorState retry={()=>void overview.refetch()}/>:!s?.sessionCode?
   <div className="admin-empty"><Radio/><h2 className="serif">No room is open yet.</h2><p>Open a session when your audience is ready to join.</p><Button onClick={()=>start.mutate(undefined,{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()})})} disabled={start.isPending}>{start.isPending?'Opening room…':'Start a presentation'} <Play size={16}/></Button>{start.isError&&<p className="error-text">The session could not be started.</p>}</div>
   :<>
    <div className="session-banner">
     <div><span className="live-dot"/><span className="eyebrow">LIVE SESSION</span><b>{s.sessionCode}</b></div>
     <div className="join-instruction">Share the code or scan to join at <strong>/join</strong></div>
     <JoinQrCard code={code}/>
     <div className="people-live"><Users size={17}/>{s.participantCount} joined</div>
     <Button kind="danger" onClick={()=>{if(confirm('End this visit for everyone?'))end.mutate({sessionCode:code},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()})});}} disabled={end.isPending}>End session</Button>
    </div>
    <div className="control-card">
     <div className="control-current"><span className="eyebrow">ON SCREEN · CHAPTER {(s.currentSlide??0)+1}</span><h2 className="serif">{slides.data?.[s.currentSlide]?.title||'Loading chapter…'}</h2><p>{slides.data?.[s.currentSlide]?.subtitle}</p></div>
     <div className="slide-selector">{slides.data?.map((slide,index)=><button key={slide.id} className={s.currentSlide===index?'selected':''} onClick={()=>move(index)}><span>0{index+1}</span><strong>{slide.title}</strong><small>{slide.subtitle}</small></button>)}</div>
     <div className="control-footer"><Button kind="outline" disabled={change.isPending||(s.currentSlide??0)<=0} onClick={()=>move(Math.max((s.currentSlide??0)-1,0))}><ChevronLeft/> Previous</Button><span>{(s.currentSlide??0)+1} of {s.slideCount} chapters</span><Button disabled={change.isPending||(s.currentSlide??0)>=s.slideCount-1} onClick={()=>move(Math.min((s.currentSlide??0)+1,s.slideCount-1))}>Next <ChevronRight/></Button></div>
    </div>
    <PollControl code={code}/>
    <PresentationControlExtras code={code}/>
   </>}
 </AdminFrame>;
}
function AdminTitle({eyebrow,title,desc}:{eyebrow:string;title:string;desc:string}){return <div className="admin-page-heading compact"><div><p className="eyebrow">{eyebrow}</p><h1 className="serif">{title}</h1><p>{desc}</p></div></div>}
function PollControl({code}:{code:string}) {
 const qc=useQueryClient();
 const active=useGetActivePoll(code,{query:{enabled:!!code,queryKey:getGetActivePollQueryKey(code),refetchInterval:6000}});
 const create=useCreatePoll();
 const close=useClosePoll();
 const setActivity=useSetSessionActivity();
 const [returnedToPresentation,setReturnedToPresentation]=useState(false);
 const [question,setQuestion]=useState('');
 const [options,setOptions]=useState(['','']);
 const pollId=active.data?.poll?.id||'';
 useEffect(()=>{setReturnedToPresentation(false);},[pollId]);
 const results=useGetPollResults(code,pollId,{query:{enabled:!!code&&!!pollId,queryKey:getGetPollResultsQueryKey(code,pollId),refetchInterval:active.data?.poll?.status==='open'?5000:false}});
 const resultBars=results.data?.results||active.data?.results||[];
 return <section className="poll-control">
  <div className="poll-control-head"><div><p className="eyebrow">ROOM PULSE</p><h2 className="serif">Ask the room.</h2></div><span>Quick polls are optional and have no right answer.</span></div>
  {active.isLoading?<LoadingBlock label="Checking for a live poll…"/>:active.isError?<ErrorState retry={()=>void active.refetch()}/>:<>
   {active.data?.poll&&<div className="poll-active"><div><span className="live-tag"><span className={active.data.poll.status==='open'?'live-dot':'idle-dot'}/>{active.data.poll.status==='open'?'OPEN POLL':'POLL CLOSED'}</span><h3>{active.data.poll.question}</h3><p>{active.data.poll.options.join(' · ')}</p><small>{active.data.poll.voteCount} responses</small></div>{active.data.poll.status==='open'&&<Button kind="outline" onClick={()=>close.mutate({sessionCode:code,pollId:active.data!.poll!.id},{onSuccess:data=>{qc.setQueryData(getGetPollResultsQueryKey(code,pollId),data);void qc.invalidateQueries({queryKey:getGetActivePollQueryKey(code)});}})} disabled={close.isPending}>{close.isPending?'Closing…':'Close and share results'}</Button>}</div>}
   {active.data?.poll&&resultBars.length>0&&<div className="poll-result-list presenter-poll-results">{resultBars.map(result=><div className="poll-result-row" key={result.option}><div><span>{result.option}</span><strong>{Math.round(result.percentage)}%</strong></div><div className="poll-result-track"><span style={{width:`${result.percentage}%`}}/></div><small>{result.count} {result.count===1?'vote':'votes'}</small></div>)}</div>}
   {active.data?.poll?.status==='closed'&&!returnedToPresentation&&<div className="poll-return-row"><p>Results stay on screen until you return to the presentation.</p><Button kind="outline" onClick={()=>setActivity.mutate({sessionCode:code,data:{activity:'presentation'}},{onSuccess:()=>{setReturnedToPresentation(true);void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(code)});}})} disabled={setActivity.isPending}>{setActivity.isPending?'Returning…':'Return to presentation'}</Button></div>}
   {(!active.data?.poll||(active.data.poll.status==='closed'&&returnedToPresentation))&&<form className="poll-form" onSubmit={e=>{e.preventDefault();create.mutate({sessionCode:code,data:{question:question.trim(),options:options.map(o=>o.trim()).filter(Boolean)}},{onSuccess:()=>{setQuestion('');setOptions(['','']);void qc.invalidateQueries({queryKey:getGetActivePollQueryKey(code)});}});}}>
    <Field label="Question for the audience" name="poll-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What would you notice first?" required maxLength={240}/>
    <div className="poll-options">{options.map((option,index)=><input key={index} value={option} onChange={e=>setOptions(options.map((o,i)=>i===index?e.target.value:o))} placeholder={`Option ${index+1}`} required maxLength={100} data-testid={`input-poll-option-${index}`}/>)}</div>
    <div className="poll-form-actions">{options.length<8&&<button type="button" className="add-choice" onClick={()=>setOptions([...options,''])}><Plus size={14}/> Add option</button>}{options.length>2&&<button type="button" className="add-choice" onClick={()=>setOptions(options.slice(0,-1))}><Minus size={14}/> Remove last</button>}<Button type="submit" disabled={!question.trim()||options.some(o=>!o.trim())||create.isPending}>{create.isPending?'Opening poll…':'Open a poll'} <Radio size={15}/></Button></div>
    {create.isError&&<p className="error-text">The poll could not be opened.</p>}
   </form>}
  </>}
 </section>;
}
function ActiveCode(){const o=useGetAdminOverview({query:{queryKey:getGetAdminOverviewQueryKey()}}); return o.data?.activeSession?.sessionCode||'';}
function AdminParticipantsPage() {
 const code=ActiveCode();
 const qc=useQueryClient();
 const [search,setSearch]=useState('');
 const p=useGetParticipants(code,{query:{enabled:!!code,queryKey:getGetParticipantsQueryKey(code),refetchInterval:7000}});
 const remove=useRemoveParticipant();
 const submissions=useGetAudienceSubmissions(code,{query:{enabled:!!code,queryKey:getGetAudienceSubmissionsQueryKey(code),refetchInterval:9000}});
 const moderate=useModerateAudienceSubmission();
 const visiblePeople=(p.data||[]).filter(person=>person.nickname.toLowerCase().includes(search.trim().toLowerCase()));
 const setModeration=(submissionId:string,status:'approved'|'answered'|'hidden')=>moderate.mutate({sessionCode:code,submissionId,data:{status}},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetAudienceSubmissionsQueryKey(code)})});
 return <AdminFrame active="/admin/participants">
  <AdminTitle eyebrow="THE ROOM" title="People, not numbers." desc="See who is with you, and keep the room comfortable."/>
  <SessionRealtime code={code}/>
  {!code?<div className="admin-empty"><Users/><h2 className="serif">No active room.</h2><p>Participant details appear when a visit is live.</p><Link href="/admin/presentation" className="text-link">Open presentation controls <ArrowRight size={15}/></Link></div>:<>
   {p.isLoading?<LoadingBlock/>:p.isError?<ErrorState retry={()=>void p.refetch()}/>:!p.data?.length?<div className="admin-empty"><Users/><h2 className="serif">A little quiet so far.</h2><p>Share session code <b>{code}</b> to welcome your audience.</p></div>:<div className="data-table-wrap">
    <div className="table-heading"><div><span className="eyebrow">CONNECTED AUDIENCE</span><h2>{p.data.length} {p.data.length===1?'participant':'participants'}</h2></div><span className="live-tag"><span className="live-dot"/> Updating live</span></div>
    <div className="participant-search"><Field label="Search participants" name="participant-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find a name"/></div>
    <table className="data-table"><thead><tr><th>NAME</th><th>CONNECTION</th><th>JOINED</th><th>QUIZ SCORE</th><th></th></tr></thead><tbody>{visiblePeople.map(person=><tr key={person.id}><td><div className="person-cell"><span className="avatar-initial">{person.nickname.slice(0,1).toUpperCase()}</span><strong>{person.nickname}</strong></div></td><td><span className={person.connected?'connection good':'connection'}><i/>{person.connected?'Here':'Away'}</span></td><td>{new Date(person.joinedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td><td>{person.score} <small>pts · {person.answeredCount} answers</small></td><td><button className="remove-person" onClick={()=>{if(confirm(`Remove ${person.nickname} from this room?`))remove.mutate({sessionCode:code,participantId:person.id},{onSuccess:()=>void qc.invalidateQueries({queryKey:getGetParticipantsQueryKey(code)})});}} aria-label={`Remove ${person.nickname}`}><X size={16}/></button></td></tr>)}</tbody></table>
    {!visiblePeople.length&&<div className="empty-inline"><Users/><p>No participants match that name.</p></div>}
   </div>}
   <section className="submission-review">
    <div className="table-heading"><div><span className="eyebrow">AUDIENCE CONTRIBUTIONS</span><h2>Questions & observations</h2></div><span className="private-tag"><LockKeyhole size={13}/> Presenter view</span></div>
    {submissions.isLoading?<LoadingBlock label="Checking audience contributions…"/>:submissions.isError?<ErrorState retry={()=>void submissions.refetch()}/>:submissions.data?.length?<div className="submission-list">{submissions.data.map(item=><article key={item.id}>
      <span className={`submission-kind kind-${item.kind}`}>{item.kind}</span>
      <div><p>{item.content}</p><small>{item.nickname} · {new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>
      <span className={`submission-status status-${item.status}`}>{item.status}</span>
      {item.kind==='question'&&item.status!=='hidden'&&item.status!=='answered'&&<div className="moderation-actions">
       {item.status==='pending'&&<Button kind="outline" onClick={()=>setModeration(item.id,'approved')} disabled={moderate.isPending}>Approve</Button>}
       <Button kind="ghost" onClick={()=>setModeration(item.id,'answered')} disabled={moderate.isPending}>Mark answered</Button>
       <Button kind="ghost" onClick={()=>setModeration(item.id,'hidden')} disabled={moderate.isPending}>Hide</Button>
      </div>}
     </article>)}</div>:<div className="empty-inline"><MessageCircle/><p>No audience contributions yet. They’ll appear here as the room shares.</p></div>}
    <p className="moderation-note">Audience questions stay private to the presenter. Approve, mark answered, or hide them here.</p>
   </section>
  </>}
 </AdminFrame>;
}
function AdminQuizPage() {
 const code=ActiveCode();
 const qc=useQueryClient();
 const bank=useGetQuizQuestions({query:{queryKey:getGetQuizQuestionsQueryKey()}});
 const current=useGetCurrentQuiz(code,{query:{enabled:!!code,queryKey:getGetCurrentQuizQueryKey(code),refetchInterval:4000}});
 const create=useCreateQuizQuestion();
 const update=useUpdateQuizQuestion();
 const del=useDeleteQuizQuestion();
 const begin=useStartQuiz();
 const advance=useAdvanceQuiz();
 const reveal=useRevealQuizAnswer();
 const revealLeaderboard=useRevealQuizLeaderboard();
 const end=useEndQuiz();
 const setActivity=useSetSessionActivity();
 const [question,setQuestion]=useState('');
  const [questionType,setQuestionType]=useState<NonNullable<QuizQuestionInput['questionType']>>('multiple-choice');
 const [choices,setChoices]=useState(['','']);
 const [correct,setCorrect]=useState(0);
 const [explanation,setExplanation]=useState('');
 const [points,setPoints]=useState(10);
 const [editing,setEditing]=useState<string|null>(null);
 const [time,setTime]=useState(30);
 const [selectedQuizQuestionIds,setSelectedQuizQuestionIds]=useState<string[]>([]);
 const [quizQuestionCount,setQuizQuestionCount]=useState(5);
 useEffect(()=>{setQuizQuestionCount(count=>Math.min(count,Math.max(1,selectedQuizQuestionIds.length)));},[selectedQuizQuestionIds.length]);
 const launchQuestionIds=selectedQuizQuestionIds.filter(id=>bank.data?.some(question=>question.id===id)).slice(0,quizQuestionCount);
 const invalidate=()=>void qc.invalidateQueries({queryKey:getGetQuizQuestionsQueryKey()});
 const refreshQuiz=()=>void qc.invalidateQueries({queryKey:getGetCurrentQuizQueryKey(code)});
  const resetEditor=()=>{setEditing(null);setQuestion('');setQuestionType('multiple-choice');setChoices(['','']);setCorrect(0);setExplanation('');setPoints(10);};
  const changeQuestionType=(next:NonNullable<QuizQuestionInput['questionType']>)=>{
   setQuestionType(next);
   if(next==='true-false'){setChoices(['True','False']);setCorrect(0);}
   else if(choices.length===2&&choices[0]==='True'&&choices[1]==='False'){setChoices(['','']);setCorrect(0);}
  };
 const save=(e:FormEvent)=>{
  e.preventDefault();
  const payload:QuizQuestionInput={question:question.trim(),questionType,options:choices.map(c=>c.trim()).filter(Boolean),correctIndex:correct,explanation:explanation.trim(),points};
  const onSuccess=()=>{invalidate();resetEditor();};
  if(editing) update.mutate({questionId:editing,data:payload},{onSuccess});
  else create.mutate({data:payload},{onSuccess});
 };
 const live=current.data?.status==='live';
 const ended=current.data?.status==='ended';
 const resultsLink=code?`/admin/results?session=${encodeURIComponent(code)}`:'/admin/results';
 return <AdminFrame active="/admin/quiz">
  <AdminTitle eyebrow="ASK, LISTEN, REVEAL" title="Make room for curiosity." desc="Build a question bank, then bring a question into the live visit."/>
  <SessionRealtime code={code}/>
  {bank.isLoading?<LoadingBlock/>:bank.isError?<ErrorState retry={()=>void bank.refetch()}/>:<>
   <QuizQuestionPicker questions={bank.data||[]} selectedIds={selectedQuizQuestionIds.filter(id=>bank.data?.some(question=>question.id===id))} onChange={setSelectedQuizQuestionIds} questionCount={quizQuestionCount} onQuestionCountChange={setQuizQuestionCount} disabled={live}/>
   <section className="quiz-live-card">
    <div className="quiz-live-info">
     <span className="eyebrow">{live?'QUIZ IN PROGRESS':ended?'QUIZ COMPLETE':'LIVE QUIZ'}</span>
     <h2 className="serif">{live?current.data?.currentQuestion?.question||'Question open to the room':ended?'The room has finished this quiz.':'The room is ready when you are.'}</h2>
     <p>{live?`Question ${current.data?.currentQuestion?.questionNumber} of ${current.data?.currentQuestion?.totalQuestions}`:ended?'Final standings remain private until you reveal them.':'Choose questions from your bank to start a shared quiz.'}</p>
    </div>
    {live?<div className="live-quiz-buttons">
     {!current.data?.revealed?<Button kind="outline" onClick={()=>reveal.mutate({sessionCode:code},{onSuccess:refreshQuiz})} disabled={reveal.isPending}><Eye size={16}/> Reveal answer</Button>:<Button onClick={()=>advance.mutate({sessionCode:code},{onSuccess:refreshQuiz})} disabled={advance.isPending}>Next question <ArrowRight size={16}/></Button>}
     <Button kind="danger" onClick={()=>end.mutate({sessionCode:code},{onSuccess:refreshQuiz})} disabled={end.isPending}>End quiz</Button>
     <Link className="text-link" href={resultsLink}>See results <ArrowUpRight size={15}/></Link>
    </div>:ended?<div className="live-quiz-buttons">
    {current.data?.leaderboardRevealed?<span className="submitted-card"><Check size={16}/> Standings shared with the room.</span>:<Button onClick={()=>revealLeaderboard.mutate({sessionCode:code},{onSuccess:refreshQuiz})} disabled={revealLeaderboard.isPending}><Eye size={16}/>{revealLeaderboard.isPending?'Sharing…':'Reveal final standings'}</Button>}
    <Link className="text-link" href={resultsLink}>See results <ArrowUpRight size={15}/></Link>
    <Button kind="outline" onClick={()=>setActivity.mutate({sessionCode:code,data:{activity:'presentation'}},{onSuccess:()=>{refreshQuiz();void qc.invalidateQueries({queryKey:getGetSessionStateQueryKey(code)});}})} disabled={setActivity.isPending}>Return to presentation</Button>
    </div>:<div className="quiz-start-options">
     <label>Answer window <select value={time} onChange={e=>setTime(Number(e.target.value))}><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>60 seconds</option></select></label>
     <Button disabled={!launchQuestionIds.length||!code||begin.isPending} onClick={()=>begin.mutate({sessionCode:code,data:{questionIds:launchQuestionIds,timeLimitSeconds:time}},{onSuccess:refreshQuiz})}>{begin.isPending?'Starting…':'Start quiz'} <Play size={15}/></Button>
    </div>}
   </section>
   {current.data?.revealed&&<div className="answer-reveal"><Eye size={16}/><p>{current.data.correctIndex!=null&&current.data.currentQuestion&&<><strong>Correct answer: {current.data.currentQuestion.options[current.data.correctIndex]}</strong><br/></>}{current.data.explanation&&<><strong>Presenter explanation</strong><br/>{current.data.explanation}</>}</p></div>}
   <div className="bank-heading"><div><p className="eyebrow">YOUR QUESTION BANK</p><h2 className="serif">{bank.data?.length||0} {bank.data?.length===1?'question':'questions'}</h2></div><span>Correct answers are private to the host.</span></div>
   <div className="question-bank">{bank.data?.length?bank.data.map((item,index)=><article className="question-bank-row" key={item.id}>
    <span className="question-number">{String(index+1).padStart(2,'0')}</span>
     <div className="question-bank-copy"><strong>{item.question}</strong><small>{item.questionType==='true-false'?'True / False':`${item.options.length} choices`} · {item.points} points · {item.category}</small></div>
     <button onClick={()=>{setEditing(item.id);setQuestion(item.question);setQuestionType(item.questionType);setChoices(item.options);setCorrect(item.correctIndex);setExplanation(item.explanation);setPoints(item.points);document.getElementById('question-editor')?.scrollIntoView({behavior:'smooth'});}} aria-label="Edit question"><Eye size={15}/><span>Edit</span></button>
    <button className="delete-button" onClick={()=>{if(confirm('Delete this question from the bank?'))del.mutate({questionId:item.id},{onSuccess:invalidate});}} aria-label="Delete question"><X size={15}/></button>
   </article>):<div className="empty-inline"><CircleHelp/><p>No questions yet. Add the first one below.</p></div>}</div>
   <form id="question-editor" className="question-editor" onSubmit={save}>
    <div className="editor-heading"><div><p className="eyebrow">{editing?'EDIT QUESTION':'BUILD THE BANK'}</p><h3 className="serif">{editing?'Refine the question.':'Add a question.'}</h3></div>{editing&&<Button kind="ghost" type="button" onClick={resetEditor}>Cancel editing</Button>}</div>
    <label className="field"><span>Question</span><textarea value={question} onChange={e=>setQuestion(e.target.value)} required maxLength={500} rows={2} placeholder="What detail marks the city’s historic homes?"/></label>
    <label className="field"><span>Question format</span><select className="question-type-select" value={questionType} onChange={e=>changeQuestionType(e.target.value as NonNullable<QuizQuestionInput['questionType']>)}><option value="multiple-choice">Multiple choice</option><option value="true-false">True or false</option></select></label>
    <div className="choices-editor"><span className="field-label">Answer choices <small>Choose the correct answer (private)</small></span>{choices.map((value,i)=><div className="choice-edit-row" key={i}><button type="button" className={correct===i?'correct-toggle':''} onClick={()=>setCorrect(i)} aria-label={`Mark choice ${i+1} correct`}>{correct===i?<Check size={15}/>:String.fromCharCode(65+i)}</button><input value={value} onChange={e=>setChoices(choices.map((c,j)=>j===i?e.target.value:c))} required disabled={questionType==='true-false'} placeholder={`Choice ${String.fromCharCode(65+i)}`} data-testid={`input-choice-${i}`}/>{questionType==='multiple-choice'&&choices.length>2&&<button type="button" className="icon-button" onClick={()=>{setChoices(choices.filter((_,j)=>j!==i));if(correct>=i)setCorrect(Math.max(0,correct-1));}} aria-label="Remove answer choice"><Minus size={15}/></button>}</div>)}{questionType==='multiple-choice'&&choices.length<8&&<button type="button" className="add-choice" onClick={()=>setChoices([...choices,''])}><Plus size={15}/> Add choice</button>}</div>
    <label className="field"><span>Explanation shown after answer reveal</span><textarea value={explanation} onChange={e=>setExplanation(e.target.value)} maxLength={1000} rows={2} placeholder="Add a short explanation for the host to share."/></label>
    <label className="field"><span>Points</span><input type="number" min={1} max={100} step={1} value={points} onChange={e=>setPoints(Number(e.target.value))} required/></label>
    <div className="editor-bottom"><span>Correct answer is never shown to participants before reveal.</span><Button type="submit" disabled={!question.trim()||choices.filter(Boolean).length<2||create.isPending||update.isPending}>{create.isPending||update.isPending?'Saving…':editing?'Save question':'Add to question bank'} <ArrowRight size={15}/></Button></div>
    {(create.isError||update.isError)&&<p className="error-text">The question could not be saved. Check the fields and retry.</p>}
   </form>
  </>}
 </AdminFrame>;
}
function AdminResultsPage() {
 const params=new URLSearchParams(window.location.search);
 const initial=params.get('session')||localStorage.getItem('marrakech.session')||'';
 const [code,setCode]=useState(initial);
 const [queryCode,setQueryCode]=useState(initial);
 const [participantSearch,setParticipantSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState<'all'|'complete'|'in-progress'>('all');
 const [sortBy,setSortBy]=useState<'score'|'name'|'accuracy'>('score');
 const [page,setPage]=useState(1);
 const [expandedParticipant,setExpandedParticipant]=useState<string|null>(null);
 const results=useGetQuizResults(queryCode,{query:{enabled:!!queryCode,queryKey:getGetQuizResultsQueryKey(queryCode)}});
 const allParticipants=results.data?.participants??[];
 const filteredParticipants=[...allParticipants]
  .filter(p=>p.nickname.toLowerCase().includes(participantSearch.trim().toLowerCase()))
  .filter(p=>statusFilter==='all'||(statusFilter==='complete'?p.completed:!p.completed))
  .sort((a,b)=>sortBy==='name'?a.nickname.localeCompare(b.nickname):sortBy==='accuracy'?b.accuracy-a.accuracy:b.score-a.score||b.correctCount-a.correctCount||a.nickname.localeCompare(b.nickname));
 const pageSize=10;
 const pageCount=Math.max(1,Math.ceil(filteredParticipants.length/pageSize));
 const visibleParticipants=filteredParticipants.slice((page-1)*pageSize,page*pageSize);
 const selectedParticipant=results.data?.participants.find(p=>p.id===expandedParticipant);
 const exportCsv=()=>{
  if(!results.data)return;
  const rows:unknown[][]=[
   ['Participant results'],
   ['Participant','Score','Correct','Incorrect','Answered','Accuracy (%)','Completed','Connected','Question','Selected answer','Correct answer','Result','Points','Response time (seconds)','Submitted at'],
  ];
  for(const participant of results.data.participants){
   if(!participant.answers.length){rows.push([participant.nickname,participant.score,participant.correctCount,participant.incorrectCount,participant.answeredCount,participant.accuracy,participant.completed?'yes':'no',participant.connected?'yes':'no','','','','','','','']);continue;}
   for(const answer of participant.answers){
    const question=results.data.questions.find(item=>item.questionId===answer.questionId);
    rows.push([participant.nickname,participant.score,participant.correctCount,participant.incorrectCount,participant.answeredCount,participant.accuracy,participant.completed?'yes':'no',participant.connected?'yes':'no',answer.question,answer.selectedOption,question?.choices[answer.correctIndex]??'',answer.isCorrect?'correct':'incorrect',answer.pointsAwarded,(answer.responseTimeMs/1000).toFixed(2),answer.submittedAt]);
   }
  }
  rows.push([],['Question analysis'],['Question','Option','Responses','Percent','Correct option','Correct participants','Incorrect participants','Unanswered participants']);
  for(const question of results.data.questions)for(const [index,answer] of question.answerCounts.entries()){
   rows.push([question.question,answer.option,answer.count,answer.percentage.toFixed(1),index===question.correctIndex?'yes':'no',question.correctParticipants.join('; '),question.incorrectParticipants.join('; '),question.unansweredParticipants.join('; ')]);
  }
  const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`marrakech-${results.data.sessionCode}-results.csv`;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const updateQueryCode=(event:FormEvent)=>{
  event.preventDefault();
  setQueryCode(code.trim().toUpperCase());
  setPage(1);
  setExpandedParticipant(null);
 };
 return <AdminFrame active="/admin/results">
  <AdminTitle eyebrow="AFTER THE VISIT" title="What the room took away." desc="Read the quiz results, question by question. This report is based on real session answers."/>
  <form className="session-lookup" onSubmit={updateQueryCode}><Field label="Session code" value={code} onChange={e=>setCode(e.target.value)} name="results-session-code" placeholder="Enter a session code"/><Button type="submit" disabled={!code.trim()}>Load analysis <ArrowRight size={15}/></Button></form>
  {!queryCode?<div className="admin-empty"><FileDown/><h2 className="serif">Choose a session.</h2><p>Enter a session code to see its quiz analysis.</p></div>:results.isLoading?<LoadingBlock label="Gathering the results…"/>:results.isError?<ErrorState retry={()=>void results.refetch()}/>:results.data?<>
   <div className="results-topline"><span className="eyebrow">SESSION {results.data.sessionCode}</span><div className="results-actions"><Button kind="outline" onClick={()=>window.print()}>Print report</Button><Button kind="outline" onClick={exportCsv}><FileDown size={16}/> Download detailed CSV</Button></div></div>
   <div className="results-stats">{[['PARTICIPANTS',results.data.summary.participantCount],['COMPLETED',results.data.summary.completedCount],['AVERAGE SCORE',results.data.summary.averageScore.toFixed(1)],['ROOM ACCURACY',`${results.data.summary.accuracy.toFixed(1)}%`]].map(([label,value])=><div key={String(label)}><span className="eyebrow">{label}</span><b>{value}</b></div>)}</div>
   <div className="results-section">
    <div className="section-subhead"><span className="eyebrow">PARTICIPANT RESULTS</span><span>{filteredParticipants.length} of {allParticipants.length} participants · scores from this session only</span></div>
    <div className="results-filters">
     <label><span>Search names</span><input value={participantSearch} onChange={e=>{setParticipantSearch(e.target.value);setPage(1);setExpandedParticipant(null);}} placeholder="Find a participant"/></label>
     <label><span>Completion</span><select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value as typeof statusFilter);setPage(1);setExpandedParticipant(null);}}><option value="all">Everyone</option><option value="complete">Complete</option><option value="in-progress">In progress</option></select></label>
     <label><span>Sort by</span><select value={sortBy} onChange={e=>{setSortBy(e.target.value as typeof sortBy);setPage(1);}}><option value="score">Score</option><option value="accuracy">Accuracy</option><option value="name">Name</option></select></label>
    </div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>NAME</th><th>SCORE</th><th>CORRECT</th><th>INCORRECT</th><th>STATUS</th><th>DETAILS</th></tr></thead><tbody>
     {visibleParticipants.map(p=><tr key={p.id}><td><strong>{p.nickname}</strong></td><td>{p.score}</td><td>{p.correctCount}</td><td>{p.incorrectCount}</td><td><span className={p.completed?'connection good':'connection'}><i/>{p.completed?'Complete':'In progress'}</span></td><td><button className="details-button" onClick={()=>setExpandedParticipant(expandedParticipant===p.id?null:p.id)}>{expandedParticipant===p.id?'Hide':'View'}</button></td></tr>)}
     {!visibleParticipants.length&&<tr><td colSpan={6}>No participants match these filters.</td></tr>}
    </tbody></table></div>
    {selectedParticipant&&<div className="participant-detail"><div className="section-subhead"><strong>{selectedParticipant.nickname} · {selectedParticipant.score} points</strong><button className="details-button" onClick={()=>setExpandedParticipant(null)}>Close</button></div>{selectedParticipant.answers.length?<ol>{selectedParticipant.answers.map(answer=>{const question=results.data!.questions.find(item=>item.questionId===answer.questionId);return <li key={answer.questionId}><strong>{answer.question}</strong><p>Your answer: {answer.selectedOption} · {answer.isCorrect?'Correct':'Incorrect'} · {answer.pointsAwarded} points · {(answer.responseTimeMs/1000).toFixed(1)} seconds</p><small>Correct answer: {question?.choices[answer.correctIndex]??'Unavailable'}</small></li>;})}</ol>:<p>This participant did not submit any answers.</p>}</div>}
    {pageCount>1&&<div className="results-pagination"><button className="details-button" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="details-button" disabled={page>=pageCount} onClick={()=>setPage(page+1)}>Next</button></div>}
   </div>
   <div className="results-section"><div className="section-subhead"><span className="eyebrow">QUESTION ANALYSIS</span><span>Option share and participant outcomes</span></div>
    {results.data.questions.map((q,i)=><article className="analysis-question" key={q.questionId}><span className="question-number">{String(i+1).padStart(2,'0')}</span><div><strong>{q.question}</strong><div className="analysis-bars"><span>Correct <b>{q.correctCount}</b></span><span>Incorrect <b>{q.incorrectCount}</b></span><span>Unanswered <b>{q.unansweredParticipants.length}</b></span></div><ul className="answer-count-list">{q.answerCounts.map((answer,index)=><li key={`${q.questionId}-${index}`}><span>{answer.option}{index===q.correctIndex?' · correct':''}</span><strong>{answer.count} responses · {answer.percentage.toFixed(1)}%</strong></li>)}</ul><details className="analysis-participants"><summary>See participants by outcome</summary><p><strong>Correct:</strong> {q.correctParticipants.join(', ')||'None'}</p><p><strong>Incorrect:</strong> {q.incorrectParticipants.join(', ')||'None'}</p><p><strong>Unanswered:</strong> {q.unansweredParticipants.join(', ')||'None'}</p></details></div></article>)}
   </div>
  </>:<div className="state-panel"><CircleHelp/><h3>No quiz results found for that session.</h3><p>Check that the session code is correct and that a quiz has been run.</p></div>}
 </AdminFrame>;
}
function AdminContentPage() {
 const qc=useQueryClient(); const slides=useGetAdminSlides({query:{queryKey:getGetAdminSlidesQueryKey()}}); const update=useUpdateSlide();
 const [values,setValues]=useState<Record<string,SlideUpdate>>({}); const [saved,setSaved]=useState<string|null>(null);
 const field=(id:string,key:keyof SlideUpdate,fallback:string)=>values[id]?.[key]??fallback;
 return <AdminFrame active="/admin/content"><AdminTitle eyebrow="EDITORIAL DESK" title="Keep the story yours." desc="Update the public chapter text and private presenter notes. Notes are only returned to authenticated hosts."/><div className="private-note-banner"><LockKeyhole size={17}/><span><strong>Private presenter notes</strong><small>Only signed-in presenters can access these notes. They never appear in audience slides.</small></span></div>{slides.isLoading?<LoadingBlock label="Loading chapters…"/>:slides.isError?<ErrorState retry={()=>void slides.refetch()}/>:slides.data?.map((slide,index)=><form className="content-edit-card" key={slide.id} onSubmit={e=>{e.preventDefault();update.mutate({slideId:slide.id,data:values[slide.id]||{}},{onSuccess:()=>{setSaved(slide.id);void qc.invalidateQueries({queryKey:getGetAdminSlidesQueryKey()});setTimeout(()=>setSaved(null),2500);}});}}><div className="content-card-head"><span className="question-number">0{index+1}</span><div><span className="eyebrow">CHAPTER {index+1}</span><h2 className="serif">{slide.title}</h2></div><span className="public-badge">PUBLIC SLIDE</span></div><label className="field"><span>Title</span><input value={field(slide.id,'title',slide.title)} maxLength={160} onChange={e=>setValues({...values,[slide.id]:{...values[slide.id],title:e.target.value}})}/></label><label className="field"><span>Subtitle</span><input value={field(slide.id,'subtitle',slide.subtitle)} maxLength={240} onChange={e=>setValues({...values,[slide.id]:{...values[slide.id],subtitle:e.target.value}})}/></label><label className="field"><span>Audience content</span><textarea rows={3} maxLength={3000} value={field(slide.id,'content',slide.content)} onChange={e=>setValues({...values,[slide.id]:{...values[slide.id],content:e.target.value}})}/></label><label className="field private-field"><span><LockKeyhole size={13}/> Presenter notes · private</span><textarea rows={3} maxLength={5000} value={field(slide.id,'notes',slide.notes)} onChange={e=>setValues({...values,[slide.id]:{...values[slide.id],notes:e.target.value}})} placeholder="Only you can see this guidance."/></label><div className="content-save-row"><span>{saved===slide.id?<span className="success-note"><Check size={14}/> Saved</span>:null}</span><Button type="submit" disabled={update.isPending}>{update.isPending?'Saving…':'Save chapter'} <Check size={15}/></Button></div></form>)}</AdminFrame>;
}
function Router() {
 const [location]=useLocation();
 return <ErrorBoundary resetKey={location}><Switch>
   <Route path="/" component={HomePage}/><Route path="/culture">{()=><EditorialPage path="/culture"/>}</Route><Route path="/history">{()=><EditorialPage path="/history"/>}</Route><Route path="/architecture">{()=><EditorialPage path="/architecture"/>}</Route><Route path="/food">{()=><EditorialPage path="/food"/>}</Route><Route path="/traditions">{()=><EditorialPage path="/traditions"/>}</Route><Route path="/music-art">{()=><EditorialPage path="/music-art"/>}</Route><Route path="/medina">{()=><EditorialPage path="/medina"/>}</Route><Route path="/jemaa-el-fnaa">{()=><EditorialPage path="/jemaa-el-fnaa"/>}</Route>
   <Route path="/present" component={ProjectorPage}/><Route path="/join" component={JoinPage}/><Route path="/quiz" component={QuizPage}/><Route path="/leaderboard" component={LeaderboardPage}/>
   <Route path="/admin" component={AdminOverviewPage}/><Route path="/admin/presentation" component={AdminPresentationPage}/><Route path="/admin/presenter" component={PresenterPage}/><Route path="/admin/participants" component={AdminParticipantsPage}/><Route path="/admin/quiz" component={AdminQuizPage}/><Route path="/admin/results" component={AdminResultsPage}/><Route path="/admin/content" component={AdminContentPage}/>
   <Route component={NotFound}/>
 </Switch></ErrorBoundary>;
}
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>; }
export default App;
