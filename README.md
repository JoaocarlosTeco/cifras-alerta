<p align="center">
  <img src="img/logo-alerta-preta.png" alt="Alerta: Aceita tua missão! Paróquia São Pio X" width="420">
</p>

<h1 align="center">Cifras Alerta</h1>

<p align="center">
  O caderno de cifras do <strong>Alerta, Paróquia São Pio X</strong>, no celular e no computador.<br>
  Em preto e branco, com os acordes fáceis de ver, e funcionando sem internet.
</p>

---

## Índice

- [O que tem](#o-que-tem)
- [Como usar](#como-usar)
- [Atalhos no computador](#atalhos-no-computador)
- [Rodar no seu computador](#rodar-no-seu-computador)
- [Adicionar uma música](#adicionar-uma-música)
- [Publicar](#publicar)
- [Organização do projeto](#organização-do-projeto)
- [Sobre as letras](#sobre-as-letras)

## O que tem

| | |
| --- | --- |
| **Categorias** | Adoração, Espírito Santo, Entrega, Reflexão e Animação. Uma música pode estar em mais de uma. |
| **Busca** | Pelo nome, pelo artista ou por qualquer trecho da letra, sem precisar de acento. A música abre já no trecho encontrado. |
| **Acordes fáceis de ver** | Em destaque, em cima da sílaba certa. No celular a linha quebra entre palavras sem desalinhar os acordes. |
| **Mudar o tom** | Sobe ou desce meio tom e mostra o tom novo e o original. O tom escolhido fica guardado em cada música. |
| **Leitura** | Tamanho da letra, modo só letra (para quem canta) e duas colunas no computador. |
| **Rolagem automática** | Com controle de velocidade. A tela não apaga enquanto a cifra está aberta. |
| **Preto ou branco** | Um botão na capa inverte tudo: fundo, textos e a logo. |
| **Compartilhar** | Manda o link da música já no tom escolhido. |
| **Sem internet** | Depois da primeira visita, abre offline. Dá para instalar como aplicativo. |

## Como usar

**No celular:** abra o link do site e, no menu do navegador, toque em **Adicionar à tela inicial**. Ele vira um ícone como um aplicativo.

**Dentro de uma música**, a barra de baixo tem tudo:

| Botão | Faz |
| --- | --- |
| `−½` `+½` | desce e sobe meio tom |
| `Tom` | mostra o tom atual; um toque volta ao original |
| `A` pequeno e `A` grande | diminui e aumenta a letra |
| ▶ | liga a rolagem automática |
| último botão | mais opções: só letra, duas colunas, sustenido ou bemol, tema e compartilhar |

## Atalhos no computador

| Tecla | Faz |
| --- | --- |
| `/` | buscar |
| `←` `→` | música anterior e próxima |
| `[` `]` | descer e subir meio tom |
| `-` `+` | diminuir e aumentar a letra |
| `espaço` | ligar e desligar a rolagem automática |
| `Esc` | fechar o menu ou limpar a busca |

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo. Não tem dependências, então não precisa de `npm install`.

```sh
npm run servir
```

Abra http://localhost:4321. O terminal também mostra o endereço para abrir no celular, se ele estiver no mesmo Wi-Fi.

| Comando | Para quê |
| --- | --- |
| `npm run servir` | abrir o site no computador |
| `npm run colar` | converter cifras coladas em `colar/` |
| `npm run importar -- <link>` | trazer músicas de um Google Doc |
| `npm run gerar` | atualizar o site depois de editar uma música |
| `npm run testar` | rodar os testes |

## Adicionar uma música

### Jeito mais fácil: colar

1. Copie a cifra, já no tom que você quer.
2. Cole num arquivo de texto dentro da pasta `colar/`. Pode ser uma música por arquivo ou várias no mesmo arquivo, uma embaixo da outra.
3. Rode `npm run colar`.

Cada música precisa começar com o título e, logo abaixo, a linha `Tom: X`. O comando põe os acordes no formato do site e avisa quais músicas novas ainda estão sem categoria.

### Pelo Google Docs

```sh
npm run importar -- "https://docs.google.com/document/d/ID_DO_DOC/edit"
npm run gerar
```

O doc precisa estar compartilhado como "qualquer pessoa com o link pode ver", com o título de cada música em negrito e os acordes na linha de cima da letra. Música que já existe aqui não é trocada (use `--forcar` para trocar).

### Na mão

Cada música é um arquivo em `musicas/`, no formato [ChordPro](https://www.chordpro.org): o acorde vai entre colchetes logo antes da sílaba em que ele entra.

```
{title: Nome da Música}
{artist: Quem canta}
{key: G}
{categoria: Adoração, Animação}

[G]Canto a me[D]lodia nova
[Em]Toda a minha [C]vida

{c: Refrão}
[G]Lá, lá, [D]lá [*x2]

{c: Solo}
[G]  [D]  [Em]  [C]
```

| Linha | Significa |
| --- | --- |
| `{title: ...}` | nome da música |
| `{artist: ...}` | quem canta (opcional) |
| `{key: ...}` | tom |
| `{categoria: ...}` | uma ou mais, separadas por vírgula |
| `{c: Refrão}` | nome de uma parte (Refrão, Solo, Ponte...) |
| `[*x2]` | anotação: aparece no lugar do acorde, mas não muda com o tom |
| `{link: ...}` | música sem cifra aqui: mostra um botão que abre a cifra em outro site |

Depois de salvar, rode `npm run gerar`. As categorias e a ordem delas ficam em `musicas/categorias.json`.

## Publicar

É um site estático: qualquer hospedagem de arquivos serve, sem comando de build.

- **Código fechado, site aberto:** deixe o repositório privado no GitHub e conecte ele ao Netlify ou ao Cloudflare Pages. Quem tem o link usa o site, mas não vê o repositório.
- **GitHub Pages:** Settings → Pages → Deploy from a branch → `main`, pasta `/ (root)`. Em conta gratuita, só funciona com repositório público.

## Organização do projeto

```
index.html            página única do site (a logo em vetor fica aqui)
css/app.css           visual, tema branco e tema preto
js/cifra.js           acordes, transposição e leitura do ChordPro
js/app.js             lista, busca, categorias e tela da cifra
sw.js                 guarda o site no aparelho para funcionar offline
musicas/*.cho         as músicas
musicas/categorias.json
dados/musicas.js      gerado pelo npm run gerar (não edite)
colar/                onde colar cifras para converter
scripts/              colar, importar, gerar e servidor local
testes/               testes automáticos
img/                  ícones e a logo em PNG (preta e branca)
```

As fontes são a Bricolage Grotesque (títulos e acordes) e a Atkinson Hyperlegible (letra), do Google Fonts. Elas ficam guardadas no aparelho depois da primeira visita.

## Sobre as letras

As letras e as cifras pertencem aos seus autores. Este caderno é para uso do grupo nos ensaios, celebrações e encontros.
