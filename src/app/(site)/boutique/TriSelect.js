'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {TRIS} from '@/lib/catalogue';

/* Sélecteur de tri.

   Les filtres de la page sont de simples liens : ils marchent sans JavaScript
   et l'URL reste partageable. Un <select> n'a pas cet équivalent en HTML pur
   sans l'envelopper dans un formulaire, d'où ce petit composant client — le
   seul de la page.

   Il pousse le tri dans l'URL au lieu de le garder en mémoire, pour rester
   cohérent avec les filtres : recharger la page conserve le tri choisi. */

const OPTIONS = [
	{valeur: TRIS.NOUVEAUTES, libelle: "Nouveautés d'abord"},
	{valeur: TRIS.PRIX_CROISSANT, libelle: 'Prix croissant'},
	{valeur: TRIS.PRIX_DECROISSANT, libelle: 'Prix décroissant'},
];

export default function TriSelect({valeur}) {
	const router = useRouter();
	const parametres = useSearchParams();

	function changer(evenement) {
		const parametresSuivants = new URLSearchParams(parametres);
		parametresSuivants.set('tri', evenement.target.value);

		// scroll: false — on retrie une liste déjà à l'écran, la renvoyer en haut
		// de page ferait perdre à l'utilisateur l'endroit qu'il regardait.
		router.push(`/boutique?${parametresSuivants}`, {scroll: false});
	}

	return (
		<select
			className='input'
			style={{padding: '8px 12px', width: 'auto', fontSize: 13.5}}
			value={valeur}
			onChange={changer}
			aria-label='Trier les produits'>
			{OPTIONS.map((option) => (
				<option key={option.valeur} value={option.valeur}>
					{option.libelle}
				</option>
			))}
		</select>
	);
}
