import { permanentRedirect } from 'next/navigation';
import { ART_PATH } from '@/lib/artCollection';

/** Short-lived earlier address of the collection; keep it working. */
export default function OldArtCanvasPage() {
  permanentRedirect(ART_PATH);
}
