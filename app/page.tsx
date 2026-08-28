import { Catalogue } from "@/components/Catalogue";
import { Epilogue } from "@/components/Epilogue";
import { Experience } from "@/components/Experience";
import { Preloader } from "@/components/Preloader";

export default function Page() {
  return (
    <main>
      {/*
        The title card. Rendered here rather than inside the film so it is in
        the server HTML and covers the very first paint — the film itself only
        mounts after hydration, and the gap before it used to show the
        catalogue underneath. It removes itself once the opening shot has
        buffered, and is hidden outright for reduced-motion visitors, who get
        the catalogue instead of a film to wait for.
      */}
      <Preloader />

      {/* The film. Mounts only when motion is welcome. */}
      <Experience />

      {/* The site underneath it — always rendered, always readable. */}
      <Catalogue />

      {/* Act 6. The film has ended; the invitation begins. */}
      <Epilogue />
    </main>
  );
}
