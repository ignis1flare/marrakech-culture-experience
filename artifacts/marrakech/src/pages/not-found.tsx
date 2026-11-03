import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <main className="not-found">
      <Link href="/" className="brand"><span className="brand-mark">م</span><span><strong>MARRAKECH</strong><small>THE RED CITY EXPERIENCE</small></span></Link>
      <div className="not-found-content">
        <span className="not-found-mark"><Compass size={30}/></span>
        <p className="eyebrow">A TURN WE DIDN’T EXPECT</p>
        <h1 className="serif">This lane<br/><em>ends here.</em></h1>
        <p>The page you’re looking for isn’t part of this visit. Let’s find our way back to the city.</p>
        <Link href="/" className="btn btn-primary"><ArrowLeft size={16}/> Return to the beginning</Link>
        <Link href="/culture" className="text-link">Or explore the chapters <ArrowLeft size={14}/></Link>
      </div>
      <span className="not-found-coordinate">31°37′ N · 7°59′ W</span>
    </main>
  );
}
