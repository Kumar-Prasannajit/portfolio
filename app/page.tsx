import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Stack from "@/components/Stack";
import Experience from "@/components/Experience";
import WorkSection from "@/components/WorkSection";
import Projects from "@/components/Projects";
import GithubHeatmap from "@/components/GithubHeatmap";
import Contact from "@/components/Contact";
import HomeShell from "@/components/HomeShell";
import Boot from "@/components/Boot";
import IdentityPanel from "@/components/IdentityPanel";

// Wide screens: the middle column is the page, the left panel is the fixed
// identity panel (portrait, time, date, viewers) and the right panel loops the
// projects (see HomeShell). Narrow screens drop the panels and stack the page's
// sections in one column, ordered by CSS.
export default function Home() {
  return (
    <>
    <Boot />
    <HomeShell
      left={<IdentityPanel />}
      middle={
        <>
          <Hero />
          <Marquee />
          <GithubHeatmap />
          <About />
          <Stack />
          <Experience />
          <WorkSection />
          <Contact />
        </>
      }
      right={<Projects />}
    />
    </>
  );
}
