/** Link de pular navegação: primeiro elemento focável da página. */
export function SkipLink() {
  return (
    <a
      href="#conteudo-principal"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white"
    >
      Pular para o conteúdo principal
    </a>
  );
}
