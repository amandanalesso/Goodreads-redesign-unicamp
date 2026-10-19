# Goodreads Redesign — protótipo navegável

Protótipo HTML/CSS/JS (sem build, sem dependências) para o trabalho de redesign do goodreads.com.
A proposta reorganiza a arquitetura de informação em torno de **listas e rankings** (modelo de catálogo de streaming),
com a jornada terminando no **botão Buy**.

## Como abrir

Abra `index.html` diretamente no navegador (duplo clique) **ou** sirva a pasta:

```bash
npx -y serve redesign
```

> `serve.json` desativa os "clean URLs" para que os links com parâmetros (`search.html?q=…`, `lists.html?list=…`) funcionem.

## Páginas

| Arquivo | O que demonstra |
|---|---|
| `index.html` | Home como vitrine: hero rotativo com o Top 3 da semana, barra de filtros globais (período, gênero, formato, nota, idioma) que refiltra todos os carrosséis, Top 10 numerado, Choice Awards, Trending, New Releases, Most Wanted, Best Books Ever, Highest Rated. Quick-view com formatos/preços e CTA de compra. |
| `search.html` | Busca com typeahead a partir de 3 caracteres (debounce 200 ms, grupos Books/Authors/Lists, navegação por teclado), abas com contagem, filtros laterais (gênero, nota, formato, ano, páginas, idioma), ordenação, card de série em ordem de leitura, estado "nenhum resultado" com *did you mean*, CTA e livros populares. Botões de exemplo cobrem cada cenário. |
| `lists.html` | Índice de listas (Editorial / Community / Choice Awards) e detalhe da lista como ranking vertical, com filtros internos, ordenação, paginação, breadcrumb e Buy como ação primária. |

Atalho global: tecla **/** foca a busca em qualquer página. O quick-view fecha por **ESC**, clique fora ou botão X.

## Padrões visuais mantidos do Goodreads (coletados em 18/10/2026)

Ver `css/tokens.css`. Resumo: Lato (UI) + Merriweather (títulos editoriais, no lugar de Copernicus);
marrom `#382110` (logo e CTA primário), verde-petróleo `#00635d` (links), verde `#3f8363` (Want to Read),
bege `#f4f1ea` (header/footer/cards), oliva `#617054` (hero), dourado `#c9a23f` (Choice Awards);
raios de 3px (botões clássicos), 10px (cards) e pill de 30px (ações do livro).

## Achados da análise heurística endereçados

| # | Achado (goodreads-heuristica.csv) | Solução no protótipo |
|---|---|---|
| 1 | Modal não fecha com ESC nem clique fora | Quick-view fecha por ESC, backdrop e X de alto contraste; foco retorna ao elemento de origem |
| 7 | Breadcrumb inconsistente | Breadcrumb `Lists › Nome da lista` em todo detalhe de lista |
| 8 | Busca por série traz Livro 3 primeiro | Score penaliza volumes > 1 e exibe card da série em ordem de leitura com "Start with #1" |
| 11 | Feed mistura orgânico e editorial | Cada carrossel/lista leva o rótulo **Editorial** ou **From the community** com cor própria |
| 12 | "Kindle Unlimited $0.00" ambíguo | Preços reais por formato; nota explícita de que KU exige assinatura ativa |
| 13 | Estado vazio sem CTA | Página de "No results" com *did you mean*, botões primários e carrossel "Popular right now" |
| 15 | "Listopia" não explicado | Aba e menu chamam-se **Lists** com sublabel "Reader-curated lists" |
| 17 | Anúncio entre header e conteúdo | Removido; abaixo do header vem direto o hero |
| 20 | Sem atalho para a busca | Tecla `/` foca a busca; dica visível no campo |
| 21 | Filtros de busca limitados | Filtros de gênero, nota, formato, ano de publicação, páginas e idioma + ordenação |
| 22 | Hierarquia de botões inconsistente | Em todas as páginas: **Buy** = primário (marrom), **Want to Read** = secundário (outline) |
| 1 (H1) | Status do sistema | Contador "(2/3)" enquanto a busca não atinge 3 caracteres; contagem de resultados por aba e por filtro |

## Dados

`js/data.js` contém ~90 livros com título, autor, nota, número de avaliações e capa obtidos do goodreads.com
(listas *Best Books Ever* e *Choice Awards 2025*). Preços, formatos, períodos de tendência e idioma de origem são
fictícios, apenas para demonstrar os filtros.

## Acessibilidade (WCAG 2.2 AA)

Verificado com auditoria automatizada no navegador (contraste efetivo considerando opacidade, nome acessível, alvos de toque, teclado, reflow a 320 px) e testes de comportamento. Teste manual com leitor de tela não foi feito.

| Critério | Solução |
|---|---|
| 1.4.3 Contraste de texto | Cinzas secundários escurecidos (#666 e #707070), selo "Winner" em marrom sobre dourado, textos do hero sem transparência |
| 1.4.11 Contraste não textual | Bordas de campos e chips em #858585 (3,6:1), estrelas de nota em #c27c0e (3,4:1) |
| 1.4.10 Reflow | Sem rolagem horizontal a 320 px nas oito telas testadas |
| 2.1.1 Teclado | Capas e títulos que abriam o drawer só com mouse viraram botões; estrelas de avaliação navegáveis por teclado |
| 2.2.2 Pausar, parar, ocultar | Botão Pause/Play no hero; pausa ao passar o mouse ou focar; começa pausado com "reduzir movimento" |
| 2.4.1 Pular blocos | Link "Skip to main content" em todas as páginas |
| 2.4.11 Foco não obscurecido | scroll-padding para os headers fixos; contorno branco sobre o hero |
| 2.5.8 Tamanho do alvo | Mínimo de 24 px (menus, links, pontos de carrossel, ações de resenha); botões grandes reduzidos de 44-48 para 40 px |
| 3.1.2 Idioma das partes | Citações e textos em espanhol e português marcados com lang |
| 4.1.2 Nome, função, valor | Selects e campos de filtro com nome; typeahead com combobox e aria-activedescendant; drawer com inert, foco preso e devolvido |
| 1.3.1 / 2.4.6 Estrutura | h1 na Home, breadcrumb com aria-current em Busca, Listas e Livro, aria-pressed nos filtros de período |
