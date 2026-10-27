"use client";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

/** Split into its own file so the zoom viewer's code is only downloaded when a customer taps the cover. */
export default function PhotoViewer({ open, close, images, alt }: { open: boolean; close: () => void; images: string[]; alt: string }) {
  return (
    <Lightbox
      open={open}
      close={close}
      slides={images.map((src) => ({ src, alt }))}
      plugins={[Zoom]}
      carousel={{ finite: images.length <= 1 }}
      render={images.length <= 1 ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
    />
  );
}
