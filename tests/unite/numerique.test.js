import {describe, expect, it} from 'vitest';
import {typeSur} from '@/server/services/digital';

/* Le type renvoyé au navigateur pour un fichier vendu.

   Il vient d'une déclaration du navigateur au moment du téléversement, donc de
   quelque chose qui n'a jamais été vérifié. Servir `text/html` depuis notre
   propre domaine serait le point de départ d'une injection de script — même si
   `attachment` et `nosniff` l'empêchent déjà, ce filtre est la troisième
   serrure, et la seule qui ne dépende pas du navigateur du visiteur. */

describe('type de contenu d’un fichier vendu', () => {
	it('laisse passer les types attendus', () => {
		expect(typeSur('application/pdf')).toBe('application/pdf');
		expect(typeSur('image/png')).toBe('image/png');
		expect(typeSur('application/epub+zip')).toBe('application/epub+zip');
	});

	it('neutralise tout ce qui pourrait être interprété', () => {
		expect(typeSur('text/html')).toBe('application/octet-stream');
		expect(typeSur('image/svg+xml')).toBe('application/octet-stream');
		expect(typeSur('application/javascript')).toBe('application/octet-stream');
	});

	it('neutralise l’absent et le farfelu', () => {
		expect(typeSur('')).toBe('application/octet-stream');
		expect(typeSur(undefined)).toBe('application/octet-stream');
		expect(typeSur('text/html; charset=utf-8')).toBe('application/octet-stream');
	});
});
