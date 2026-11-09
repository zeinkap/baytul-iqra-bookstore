import { getCatalogBooks } from './catalog';
import { ART_ITEM_PATH, artSlugs, isArtPiece } from './artCollection';

/** All paintings with their address (/art-canvases/<slug>), newest first like the catalog. */
export async function getArtPieces() {
  const pieces = (await getCatalogBooks()).filter((b) => isArtPiece(b.categories));
  const slugs = artSlugs(pieces);
  return pieces.map((piece) => ({ piece, slug: slugs.get(piece.id)!, href: `${ART_ITEM_PATH}/${slugs.get(piece.id)}` }));
}
