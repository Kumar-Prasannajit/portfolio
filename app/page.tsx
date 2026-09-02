import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import TechStack from "@/components/TechStack";
import Projects from "@/components/Projects";
import OpenSource from "@/components/OpenSource";
import GithubHeatmap from "@/components/GithubHeatmap";
import Experience from "@/components/Experience";
import Gallery from "@/components/Gallery";
import NowPlaying from "@/components/NowPlaying";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <About />
        <TechStack />
        <Projects />
        <OpenSource />
        <GithubHeatmap />
        <Experience />
        <Gallery />
        <NowPlaying />
      </main>
      <Footer />
    </>
  );
}
