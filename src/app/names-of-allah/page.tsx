import { permanentRedirect } from 'next/navigation';
import { ART_PATH } from '@/lib/artCollection';

/** The collection used to live here; keep old links and shared posts working. */
export default function OldNamesOfAllahPage() {
  permanentRedirect(ART_PATH);
}
