import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Hero from '../components/landing/Hero';
import LandingNav from '../components/landing/LandingNav';
import { Features, FinalCta, HowItWorks, LandingFooter, Pricing, Testimonials } from '../components/landing/Sections';
import { useAuth } from '../context/AuthContext';

const TITLE = 'Finora — Your AI-powered tax & financial assistant for India';

export default function Landing() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = TITLE;
  }, []);

  // Signed-in users go straight to their area. Guests see the page immediately, without waiting on the session check.
  if (user) return <Navigate to={user.role === 'customer' ? '/dashboard' : '/expert'} replace />;

  return (
    <div className="landing lp">
      <LandingNav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Pricing />
        <Testimonials />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
