import PageIntrouvable from '@/components/PageIntrouvable/PageIntrouvable';

/* Le 404 des pages de la vitrine : un produit archivé, un article dépublié, un
   slug qui ne répond plus. L'en-tête et le pied de page viennent du layout. */

export const metadata = {
	title: 'Page introuvable',
};

export default function NonTrouve() {
	return <PageIntrouvable />;
}
