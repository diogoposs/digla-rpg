# Guia do código — Digla RPG

Comece por `public/js/config.js` para ajustes gerais e por `public/js/world/map.js` para editar o mapa. Os arquivos têm comentários em português. O projeto usa JavaScript puro, módulos ES e Canvas 2D; não há etapa de compilação.

## Onde está cada coisa

### Multiplayer e salvamento sem banco — 1.0

**Hospedagem:** `render.yaml` descreve um servidor Node gratuito, porta automática do provedor e health check `/healthz`. `.github/workflows/ci.yml` executa formatação, regras/HTTP e testes de navegador em Linux/Node 24; Actions têm permissão apenas de leitura do código. O Blueprint solicita deploy após checks passarem. A ativação do serviço é feita na conta Render pelo botão do README.

`server/hosting.mjs` lê `PUBLIC_ORIGIN` ou `RENDER_EXTERNAL_URL`. `server/api.mjs` compara Origin com esse valor e emite cookies Secure em HTTPS; não confia em cabeçalhos de proxy arbitrários. Sem origem configurada, localhost e rede local continuam funcionando por HTTP. `GET /api/server-info` informa apenas versão, multiplayer e se os salvamentos são temporários. Com `DIGLA_TEMPORARY_SAVES=1`, `public/app.js` mostra esse aviso no login. `tests/hosting.test.mjs` e o teste HTTP verificam origem, cookies, bloqueio de origem externa e compatibilidade local.

O Blueprint **não inclui dados locais nem armazenamento persistente**: o filesystem Free pode ser apagado em suspensões/reinícios/deploys. Nunca use Git como backup de contas. Para preservar dados online futuramente, configure armazenamento privado persistente e mantenha apenas um servidor por pasta de dados.

| Arquivo                           | Responsabilidade                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/multiplayer.mjs`          | Mundo único, fila de ações, presença, snapshots por jogador, eventos, colisão, limite de velocidade, chat, grupos, reserva de loot e trocas com confirmação dupla.          |
| `server/storage.mjs`              | `openMultiplayerStore()`: importa contas antigas e grava contas/mundo juntos em `data/game.json`, via arquivo temporário e rename.                                          |
| `server/api.mjs`                  | Autenticação, sessão única por conta, leitura dos pedidos e execução na fila do mundo; valida posições antes de aceitar.                                                    |
| `server/mobs.mjs`                 | Vida e inteligência compartilhadas; timers e alvo dos monstros são únicos, ataques automáticos e venenos são individuais. Integra os callbacks de XP e loot do multiplayer. |
| `server.mjs`                      | HTTP, cabeçalhos de segurança e endereço/porta. Usa `HOST` (`0.0.0.0`), `PORT` (`3000`) e `DIGLA_DATA_DIR` (`data/`).                                                       |
| `public/js/ui/multiplayer.js`     | Painel Online, chat, convites, ofertas e confirmações de troca, nomes e barras dos outros jogadores. Texto recebido é inserido como texto, sem interpretar HTML.            |
| `public/styles/multiplayer.css`   | Aparência dos painéis e nomes.                                                                                                                                              |
| `public/js/game/world.js`         | Consulta snapshots, distribui efeitos, atualiza os jogadores remotos e interpola posições.                                                                                  |
| `public/js/game/renderer.js`      | Desenha personagens remotos com seus outfits, respeitando piso e profundidade.                                                                                              |
| `tests/multiplayer.test.mjs`      | Concorrência, loot reservado, XP de grupo, movimento, trocas e migração com relógio controlado.                                                                             |
| `tests/multiplayer-http.test.mjs` | Servidor de produção em porta aleatória, dois usuários, combate independente, privacidade e reinício.                                                                       |
| `tests/multiplayer.spec.mjs`      | Dois navegadores reais vendo e movendo jogadores, conversando, formando grupo e concluindo troca.                                                                           |

**Como os dados se separam:** `SHARED` em `server/multiplayer.mjs` liga monstros, corpos, chão, cargas de minério, revisão e modo de teste ao objeto `world` único. Esses campos usam acessores não enumeráveis em cada conta; o JSON os grava uma única vez em `world`. Posição, inventário, banco, equipamentos, vida/mana, skills e missões pertencem à conta. Snapshots de outros jogadores têm apenas ID, nome, outfit, posição, direção e vida; nunca senha/hash, banco ou inventário.

**Ciclo:** um timer de 100 ms executa `pulse()` na mesma fila das ações HTTP. A fila impede recolher a mesma pilha duas vezes e intercalar commits de troca. O corpo HTTP é lido antes da fila, para um upload incompleto não bloquear o mundo. Cada personagem controla seu alvo de ataque; cada monstro tem um alvo de perseguição e uma recarga únicos. `POST /api/world/tick` consulta o estado; não acelera a simulação. O cliente consulta a cada 250 ms e interpola os personagens remotos. Não há WebSocket nem dependência externa.

**Grupos e loot:** `companions()` limita partilha a membros vivos do grupo, no mesmo piso e a oito quadrados. XP de dano é dividido, preservando o total. `contributions` registra dano real por monstro; quem mais contribuiu e o grupo próximo recebem reserva de loot por 60 segundos. Depois libera para todos. Ao morrer, o monstro também gera crédito para participantes próximos em missões.

**Trocas:** `POST /api/social` aceita `tradeInvite`, `tradeAccept`, `tradeOffer`, `tradeConfirm` e `tradeCancel`. A oferta vincula slot, ID e quantidade; qualquer alteração incrementa a revisão e limpa confirmações. As duas confirmações precisam apontar à revisão atual. A transferência é planejada em cópias das duas mochilas e só aplicada se todos os itens e espaços forem válidos; um único salvamento inclui os dois inventários. Saída, distância maior que um quadrado ou dois minutos sem atualização da oferta cancelam. Nenhum item sai da mochila durante a negociação.

**Outras ações sociais:** `chat`, `partyInvite`, `partyAccept`, `partyLeave`. Chat e grupos ficam em memória. Presença expira após dez segundos sem comunicação. A área protegida permite sobrepor jogadores para não bloquear o spawn; fora dela há colisão. O servidor só aceita um passo cardinal por movimento, transições de piso cadastradas e velocidade compatível com H. A página antecipa o movimento e corrige a posição se o servidor rejeitar.

**Modo global:** nesta versão multiplayer, apenas o dono do servidor configura `DIGLA_TEST_MODE=1` antes de iniciar. A aba de modo explica isso e não permite alteração pelo jogador. O padrão é normal, inclusive para contas importadas; os campos individuais antigos de configuração deixam de controlar o mundo.

**Arquivos privados:** `data/game.json` contém `{schema:1, accounts, world}`. Na ausência dele, `accounts.json` é importado e preservado como backup. O mundo começa compartilhado, sem juntar os antigos estados individuais de chão/monstros. Use um único processo por pasta; copie `data/` com o servidor parado para fazer backup. Sessões, chat, grupos e negociações não persistem. `data/`, `.env*`, logs e resultados de testes são ignorados pelo Git. O servidor só publica os arquivos autorizados de `public/`.

**Rede:** execute `npm.cmd run dev` e abra `http://localhost:3000`; outra máquina na mesma rede usa `http://IP-DO-SERVIDOR:3000`. Para restringir ao próprio computador: `$env:HOST='127.0.0.1'`. O projeto não modifica firewall/roteador. GitHub guarda o código; não hospeda o processo Node nem as partidas.

### Aventura, economia e progressão — 0.9

| Arquivo                             | O que alterar                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/js/game/adventure-rules.js` | `QUESTS`: sequência, objetivos e recompensas; `RECIPES`: ingredientes, nível e XP; `ORE_NODES`/`FORGE`: posições; `combatStats()`: ATK/Combate/ARM; `prices()`: compra/venda normal e teste. |
| `server/adventure.mjs`              | Aceitar/entregar missões, validação do NPC, recompensas pendentes, extração com cargas/recuperação, fabricação e alteração do modo de teste.                                                 |
| `server/inventory.mjs`              | Planejamento de entregas e fabricação em cópias do inventário, sem consumir antes de validar todos os resultados.                                                                            |
| `public/js/ui/adventure.js`         | Diário, abas, progresso, configuração do modo, receitas, botões dos veios/forja e resumo de combate na lateral.                                                                              |
| `public/styles/adventure.css`       | Aparência do diário, recursos, avisos dos monstros e mira do E.                                                                                                                              |
| `server/mobs.mjs`                   | Aplicação de ATK e mitigação, registro de abates, arqueiro/xamã/defensor, especiais anunciados e reinício do chefe. `state.creatures[id].special` guarda geometria e horário do dano.        |
| `public/js/game/world-rules.js`     | Definições e spawns dos novos orcs. `maxHealth` representa o modo 10×; `mobMaximum()` usa 1/10 para orcs no modo normal.                                                                     |
| `public/js/world/map.js`            | Parede/porta da sala do comandante no piso -1 e colisão dos veios/forja.                                                                                                                     |
| `public/js/graphics/adventure.js`   | Tapete da sala do chefe e detalhes visuais de cada novo tipo de orc.                                                                                                                         |
| `public/js/game/world.js`           | Mira E, confirmação sem caminhar e desenho dos tiles de perigo, seguindo câmera/zoom/andar.                                                                                                  |

Estado salvo: `quests`, `gathering` e XP de `skills.mining`/`skills.smithing` são pessoais. No multiplayer, `gameSettings` e `miningNodes` são do mundo compartilhado, como explicado acima. O JSON inteiro continua excluído do Git.

`POST /api/world/adventure` recebe `action` (`accept`, `claim`, `mine`, `craft`, `stop`, `settings`) e `id` quando necessário. Todas as mudanças são validadas no servidor. `POST /api/world/cast` aceita `{key:'e',x,y,z}` para uma área sem alvo selecionado; Q/W continuam exigindo alvo. Recompensas não concedem XP de Vitalidade, que continua vindo apenas de dano real.

### Corrida, templo, poções rápidas e corpos

- **`game/utility-rules.js`**: duração e recargas de H/B, poções permitidas, migração dos três `quickSlots` e `cancelRecall()` para interromper casting ao sofrer dano ou caminhar.
- **`server/utility.mjs`**: valida `/api/world/utility`, cobra os 10 de mana do H, configura/usa os atalhos e acompanha os 10 segundos de retorno. A recarga de B começa após chegar; os horários são persistidos em `account.utility`. O casting é cancelado se o intervalo entre ticks passar de 2 segundos, impedindo retorno offline.
- **`game/movement.js`** recebe `speedMultiplier`; `game/game.js` usa 1,5 enquanto `hasteUntil` estiver ativo. Caminhada automática e setinhas usam a mesma velocidade.
- **`ui/utility-bar.js`**: botões 1/2/3/H/B, configuração pelo direito e animação do retorno com progresso. `styles/world.css` posiciona as barras compactas; `styles/skills.css` e `styles/cooking.css` centralizam os painéis de atividades.
- **`game/world-rules.js`**: `CORPSE_LIFETIME_MS` define 120.000 ms. `server/mobs.mjs` registra `createdAt`/`expiresAt`; mortes repetidas arquivam corpos anteriores em `extraCorpses`. `getCorpses()` reúne os corpos atuais e anteriores.
- **`server/ground-cleanup.mjs`** remove corpos vencidos e o loot contido, independentemente do ciclo de 15 minutos dos itens. `server/items.mjs` aceita `source: 'corpse'`, apenas para `target: 'ground'`, e exige proximidade, andar correto e destino transitável. `ui/ground-items.js` cria as alças de arraste; mover conserva o prazo.

### Cajado de raio e habilidades

- **`game/lightning-rules.js`** centraliza `LIGHTNING_STAFF`, a fórmula `lightningDamage(level) = 3 + 5 × nível`, intervalo automático de 3000 ms, recarga global de 500 ms e `LIGHTNING_ABILITIES` com custos, multiplicadores, áreas e recargas individuais. Altere esses valores aqui.
- **`items.js`** cadastra `lightning_staff` como arma com ATK 3 e alcance 3; o catálogo da loja de Matlo inclui o item automaticamente por 1 ouro. `game/look-rules.js` descreve a arma.
- **`server/mobs.mjs`** → `damageMob()` concentra dano real, fraquezas, Magia/Combate, Vitalidade, morte e loot, para que auto-ataque e habilidades sigam as mesmas regras. `hitMob()` mantém o ataque antigo e aplica a fórmula/intervalo próprios ao Cajado de raio.
- **`cast()`**, acessado pela rota **`POST /api/world/cast`**, aceita apenas `{ key: 'q' | 'w' | 'e' | 'r' }`; dano, alvo, custo e geometria são decididos pelo servidor. Q/W/E usam o alvo selecionado; E centraliza 3×3 nele; R usa 5×5 no personagem e cura 25% do máximo no instante do lançamento. Somente mobs no mesmo piso e com linha de visão recebem dano.
- **`state.poisons`** mantém os cinco pulsos do W, com dano calculado no lançamento, próximo segundo e quantidade restante. Os pulsos continuam após parar o auto-ataque ou sair do alcance, mas são cancelados ao pausar/sair, morrer ou mudar de piso. **`account.abilityCooldowns`** salva os horários de liberação de Q/W/E/R e `global`, bloqueando repetição e recarga removida por atualização da página. As restrições são registradas antes do `await save()`.
- **`ui/lightning-abilities.js`** desenha a barra somente com o cajado equipado, usando os ícones de `graphics/ability-icons.js`, teclas e recargas. Nome, mana e detalhes aparecem ao passar o mouse. `game/input.js` captura Q/W/E/R e ignora repetição da tecla e campos de texto. `game/actions.js` encaminha as teclas e `game/world.js` sincroniza a barra com a API.
- **`ui/element-effects.js`** desenha feixes ramificados, faíscas, runas de tempestade 3×3 e anéis de choque 5×5 ajustados ao zoom; `styles/world.css` define cores e aparência. Os números de dano continuam usando o elemento do golpe.
- **F** usa `world/attack` com `{ nearest: true, toggle: false }`. O servidor escolhe o vivo mais próximo no mesmo piso; o botão direito mantém `{ mobId }` para alternar o alvo. A seleção fora do alcance não cria caminhada automática.

### Vitalidade, poções e regeneração

- **`game/skill-rules.js`** contém o cálculo compartilhado de nível, preservando o export `skillProgress` de `game/progression.js`. Este último migra `skills.vitality.xp` e publica a nova skill na API; `ui/skills.js` e `index.html` exibem seu progresso.
- **`game/vitality-rules.js`** → `gainVitalityXp(account, damage)` acrescenta dano real / 3 em terços exatos, evitando erros acumulados na passagem de nível. `server/mobs.mjs` chama essa função no ponto central de dano causado, incluindo todas as armas e elementos. Novas fontes de dano devem chamar o mesmo helper com o dano efetivamente retirado.
- **`syncVitals()`** calcula os máximos a partir do nível: `100 + 30 × (nível - 1)` de vida e `100 + 15 × (nível - 1)` de mana. `ensureWorld()` usa esse cálculo em vez de fixar os máximos em 100. A operação é idempotente e mantém vida/mana atuais, sem refazer o ganho ao atualizar a página.
- **`server/nutrition.mjs`** define `FOOD_HEALTH = 20`, `FOOD_MANA = 15`, `FOOD_INTERVAL_MS = 3000` e `FOOD_TICKS_PER_SALMON = 20`. `eatSalmon()` adiciona intervalos; `tickNutrition()` aplica os vencidos, limita aos máximos e avança o próximo intervalo antes de salvar. O estado fica em `account.foodEffect`, com `remainingTicks` e `nextTickAt`, preservando a duração ao reabrir a conta. `server/world.mjs` processa o efeito no tick do mundo antes de publicar os atributos.
- **`items.js`** define `health_potion` e `mana_potion`, com `category: 'potion'`, `restores` e `amount`. `server/items.mjs` aplica a recuperação instantânea, valida recurso cheio e consome uma unidade. `game/look-rules.js` mostra os efeitos dos novos itens e do salmão.
- **`world/map.js`** inclui a casa do Pang com `shop: 'potions'`. Sua posição é compartilhada por `TOWN_POINTS.potions` em `game/town-rules.js`; `shopStock('potions')` separa seu catálogo das lojas de alimentos e equipamentos. `graphics/town.js` desenha o NPC e `graphics/shop-details.js` desenha os frascos na parede e na placa.
- **`index.html`** mantém `floor-label` e `minimap-legend` ocultos, para retirar os textos visíveis sob o minimapa sem interferir na troca de pisos.

### Decorações, fundos e inspeção

- **`public/js/world/vegetation.js`**: `treeStyleAt()` fixa uma espécie por região: `oak` na vila, `pine` nos orcs, `charred` no fogo e `palm` na costa. `BIOME_TREES` contém as árvores adicionais em coordenadas fixas. `world/map.js` define suas posições e colisões; `graphics/scenery.js` desenha a espécie, sem sortear cores de copa.
- **Casas das lojas**: `houses` em `world/map.js` usa `shop: 'food'` para Rafhi e `shop: 'gear'` para Matlo. `graphics/scenery.js` monta os expositores na parede e a placa à esquerda da porta. `graphics/shop-details.js` desenha os emblemas de peixe e armadura compartilhados pela parede e pela placa. A chave do cache das casas inclui `shop` para preservar a decoração correta.

- **`public/js/world/decorations.js`**: `decorationAt(x, y, z)` distribui os detalhes por bioma e andar; `DECORATION_NAMES` define seus nomes para Olhar. O sorteio usa coordenadas fixas e não muda ao atualizar a página. As decorações são visuais e deixam escadas e chegadas livres.
- **`public/js/graphics/decorations.js`**: `drawDecoration()` desenha basalto, cristais, corais, estandartes, ruínas e os outros sprites. Edite as cores e formas aqui. `game/renderer.js` inclui esses objetos na ordem de profundidade, junto aos personagens.
- **`public/js/graphics/terrain.js`**: o caso de terreno `void` desenha o fundo texturizado das montanhas (+1) e cavernas (-1). O cache distingue o andar; o fundo continua sem colisão caminhável.
- **`public/js/game/look-rules.js`**: nomes e descrições em inglês de itens, pisos e objetos. `lookItem()` acrescenta quantidade e informações úteis, como cura e alcance.
- **`public/js/ui/inspection.js`**: captura Shift + esquerdo para inspecionar e direito em itens para abrir o menu. **Olhar** só mostra texto; **Usar/Recolher/Guardar/Retirar** encaminha a ação existente. A mensagem verde e o menu são estilizados em `public/styles/world.css`.
- **`public/js/game/world.js`**: resolve o objeto sob o cursor, exige proximidade ao usar fonte, fogão, NPC, água ou corpo e seleciona ataques sem caminhar até o alvo. Caminhada pelo mouse usa apenas o esquerdo; o arrasto mantém a aproximação até a origem do item.

```text
Digla RPG/
├── Iniciar Digla.cmd          Abre o servidor no Windows
├── package.json              Comandos e dependências de desenvolvimento
├── server.mjs                Inicia o servidor multiplayer na porta 3000
├── server/
│   ├── api.mjs               Cadastro, login, sessão, posição e rotas das atividades
│   ├── multiplayer.mjs       Mundo compartilhado, presença, chat, grupos e trocas
│   ├── fishing.mjs           RNG de pesca, bônus, recompensas e validações
│   ├── cooking.mjs           Consumo de peixe, RNG de cozinha e XP de Culinária
│   ├── world.mjs             Conecta combate, itens, lojas, banco e limpeza
│   ├── town.mjs              Compra/venda e transferências do banco
│   ├── ground-cleanup.mjs    Ciclos de limpeza do chão e data persistida
│   ├── mobs.mjs              Combate, perseguição, fraquezas, loot e XP por dano
│   ├── items.mjs             Comida, transferências, equipamento e elemento
│   ├── storage.mjs           Grava contas e mundo em um documento JSON atômico
│   └── http.mjs              Respostas HTTP e entrega da pasta public/
├── data/
│   ├── game.json             Contas e mundo privados (gerado automaticamente)
│   └── accounts.json         Backup privado da versão anterior, quando existente
├── public/
│   ├── index.html            Estrutura e textos das telas
│   ├── app.js                Conecta menu e jogo; ciclo de animação
│   ├── style.css             Importa os estilos abaixo, na ordem correta
│   ├── styles/
│   │   ├── base.css          Tema, cores gerais, fontes e elementos básicos
│   │   ├── menu.css          Tela inicial, login e cadastro
│   │   ├── outfit.css        Seleção e personalização do personagem
│   │   ├── game.css          Mapa, nome do personagem, painel lateral e minimapa
│   │   ├── inventory.css     Barras de vida/mana, equipamento e mochila
│   │   ├── skills.css        Painel de skills, barra de pesca e ícone de salmão
│   │   ├── cooking.css       Menu do fogão e indicação de ação F
│   │   ├── world.css         Orc, números de dano, arrasto no chão e janela de loot
│   │   ├── town.css          Painéis de lojas e banco
│   │   └── responsive.css    Ajustes para telas menores
│   └── js/
│       ├── config.js         Velocidade, escala, dimensões, spawn, cores e outfits
│       ├── api.js            Chamadas do navegador para o servidor
│       ├── items.js          Catálogo, ícones, tipo de equipamento e empilhamento
│       ├── world/
│       │   ├── map.js        Terrenos, casas, objetos e colisões
│       │   ├── elevation.js  Castelo, montanhas, cavernas, andares e passagens
│       │   └── random.js     Variações fixas de detalhes por coordenada
│       ├── graphics/
│       │   ├── drawing.js    Ferramentas para desenhar pixels, sombras e contornos
│       │   ├── terrain.js    Aparência das pedras, cascalho, grama e água
│       │   ├── character.js  Sprites dos três outfits e suas animações
│       │   ├── stove.js      Fogão de pedra e animação do fogo
│       │   ├── temple.js     Pátio sem paredes, quatro colunas e fonte animada
│       │   ├── elemental.js  Sprites animados e restos dos elementais de fogo/água
│       │   ├── elevation.js  Torres, bandeiras e portão do castelo
│       │   ├── town.js       Desenho dos comerciantes, balcões e banco
│       │   ├── orc.js        Sprite verde, direções, animação e cadáver do orc
│       │   ├── ground-items.js  Desenha os ícones dos itens no chão
│       │   └── scenery.js    Desenho das casas, árvores, pedras, postes e placa
│       ├── game/
│       │   ├── game.js       Entrada/saída, informações na tela e salvamento
│       │   ├── actions.js    F escolhe orc, fogão ou pesca; Esc interrompe
│       │   ├── world.js      Sincroniza combate, comida, arrastar e recolher itens
│       │   ├── world-rules.js  Vida do orc, dano, cura, tempos e novos dados da conta
│       │   ├── town-rules.js   Posições dos NPCs, catálogo das lojas e 48 slots do banco
│       │   ├── cooking.js    Menu, preparo um a um e chamadas de cozinha
│       │   ├── cooking-rules.js  Receita, chance, tempo, XP e alcance do fogão
│       │   ├── input.js      Setinhas, F, Esc, foco e pausa
│       │   ├── fishing.js    Interação com F, animação da barra e chamadas da pesca
│       │   ├── fishing-rules.js  Intervalo, chance, XP por peixe e alcance da água
│       │   ├── progression.js   XP, níveis e compatibilidade com contas antigas
│       │   ├── movement.js   Passos, velocidade e verificação de colisões
│       │   ├── navigation.js Caminhada por clique e aproximação de itens/alvos
│       │   ├── pathfinding.js Caminhos e linha de visão compartilhada com servidor
│       │   ├── renderer.js   Câmera e ordem de desenho do cenário
│       │   └── minimap.js    Desenho do minimapa
│       └── ui/
│           ├── auth.js       Formulário de login/cadastro
│           ├── outfit.js     Botões, cores e rotação da prévia
│           ├── inventory.js  Equipamento, abrir/fechar mochila e desenhar salmões
│           ├── damage-numbers.js  Números flutuantes e destaque do dano máximo
│           ├── ground-items.js    Áreas transparentes para arrastar as pilhas no chão
│           ├── loot.js       Janela de loot, arrasto e retirada de armas
│           ├── mobs.js       Nomes, barras de vida e fraquezas de todos os inimigos
│           ├── staff.js      Seletor de elemento e equipar/guardar cajado
│           ├── town.js       Seleção de itens e compra/venda/guardar/retirar
│           ├── element-effects.js  Projéteis e impactos de fogo, água e raio
│           ├── skills.js     Abrir/fechar painel e mostrar nível/progresso
│           └── dom.js        Pequenos auxiliares de interface
├── tests/                    Testes das contas e das interações no navegador
└── docs/GUIA-DO-CODIGO.md     Este guia
```

## Como experimentar uma mudança

1. Abra a pasta do projeto no seu editor, por exemplo o VS Code.
2. Abra um terminal nessa pasta e execute `npm start`.
3. Acesse `http://localhost:3000`.
4. Edite um arquivo, salve e atualize a página com `Ctrl+F5`.

Mudanças nos arquivos de `public/` são lidas pelo navegador ao atualizar a página. Quando alterar o servidor, **ou as regras compartilhadas de mapa/configuração**, reinicie o terminal com `Ctrl+C` e `npm start` para que navegador e servidor usem as mesmas regras. `npm run dev` reinicia automaticamente o servidor quando um dos módulos que ele importa muda. Reiniciar o servidor encerra as sessões; entre novamente com sua conta.

## Quero mudar…

| O que você quer alterar              | Onde editar                                                              |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Velocidade da caminhada              | `config.js` → `STEP_DURATION_MS`                                         |
| Tamanho visual dos pixels            | `config.js` → `WORLD_SCALE` (use inteiros)                               |
| Ponto inicial de novas contas        | `config.js` → `SPAWN`                                                    |
| Tamanho da área                      | `config.js` → `WIDTH` e `HEIGHT`                                         |
| Cores disponíveis para os outfits    | `config.js` → `COLORS` e `COLOR_NAMES`                                   |
| Visual inicial de novas contas       | `config.js` → `DEFAULT_OUTFIT`                                           |
| Onde há pedra, cascalho e água       | `world/map.js` → `tileAt()`                                              |
| Posição e tamanho das casas          | `world/map.js` → `houses`                                                |
| Onde aparecem árvores e objetos      | `world/map.js` → `propAt()`                                              |
| O que bloqueia a caminhada           | `world/map.js` → `walkable()`                                            |
| Cor e textura do chão                | `graphics/terrain.js` → `PALETTES` e funções `draw…`                     |
| Corpo, rosto, roupas e acessórios    | `graphics/character.js` → funções `draw…`                                |
| Fonte, tamanho e cor do nome no mapa | `styles/game.css` → `.player-label`                                      |
| Posição do nome acima do sprite      | `game/renderer.js` → `playerScreen`                                      |
| Aparência do menu                    | `styles/menu.css`                                                        |
| Textos dos títulos e botões          | `index.html`; mensagens dinâmicas em `ui/auth.js`                        |
| Regras de nome/senha                 | `server/api.mjs`; validação visual também em `index.html` e `ui/auth.js` |
| Intervalo do salvamento              | `config.js` → `AUTOSAVE_INTERVAL_MS`                                     |
| Porta do servidor                    | Variável de ambiente `PORT`, padrão em `server.mjs`                      |
| Chance de arma no loot               | `game/world-rules.js` → `ORC_DROP_CHANCE` (atualmente 1, ou 100%)        |
| Moedas por orc / taxa de conversão   | `game/world-rules.js` → `COIN_DROP_MIN/MAX`, `GOLD_PER_SILVER`           |
| Dano do cajado por nível             | `game/world-rules.js` → `STAFF_DAMAGE_MIN/MAX`, `STAFF_DAMAGE_PER_LEVEL` |
| Posição e tamanho do templo / fonte  | `config.js` → `TEMPLE`, `WELL`; colisões em `world/map.js`               |
| Posição, vida e fraqueza dos mobs    | `game/world-rules.js` → `MOB_DEFINITIONS`                                |
| Bônus da fraqueza elemental          | `game/world-rules.js` → `WEAKNESS_MULTIPLIER` (1,5)                      |
| Alcance de espada/cajado             | `items.js` → `range` (1 e 3)                                             |
| Fração do dano convertida em XP      | `game/world-rules.js` → `WEAPON_XP_FACTOR` (0,5)                         |
| Cores de magia e animações           | `styles/world.css`, `ui/element-effects.js`                              |
| Ciclo de limpeza do chão             | `game/world-rules.js` → `GROUND_CLEANUP_INTERVAL_MS`                     |
| Limites dos territórios              | `config.js` → `FIRE_REGION`, `WATER_REGION`; terreno em `world/map.js`   |
| Novos itens e seus espaços           | `items.js` → `ITEMS`, `equipmentSlot`, `stackable`                       |
| Preços e catálogo das lojas          | `game/town-rules.js` → `shopStock()`; cobrança em `server/town.mjs`      |
| Posições dos vendedores e banco      | `game/town-rules.js` → `TOWN_POINTS`                                     |
| Capacidade do banco                  | `game/town-rules.js` → `BANK_CAPACITY`                                   |
| Ícones do minimapa                   | `game/minimap.js` → `MINIMAP_MARKERS`, `drawMarker()`                    |
| Pontos sugeridos de pesca            | `world/map.js` → `FISHING_SPOTS`                                         |
| Área inicial sem monstros            | `config.js` → `SAFE_ZONE`; `world/elevation.js` → `isSafeZone()`         |
| Castelo e limites do território orc  | `world/elevation.js` → `ORC_CASTLE`, `ORC_REGION`                        |
| Montanhas e cavernas                 | `world/elevation.js` → `MOUNTAINS`, `CAVES`                              |
| Escadas, buracos e destinos          | `world/elevation.js` → `FLOOR_LINKS`                                     |

Os caminhos abreviados da tabela ficam dentro de `public/js/`, exceto quando começam por `styles/`, `server/` ou são arquivos na raiz.

## Exemplos práticos

### Inventário, equipamentos, vida e mana

O minimapa fica no topo da lateral. As seções abaixo estão em `public/index.html` e seus estilos em `public/styles/inventory.css`. Os painéis antigos do aventureiro e das setinhas foram removidos.

Em `public/js/config.js`, `BACKPACK_CAPACITY` define os 12 espaços da mochila, e `INITIAL_VITALS` define a vida/mana inicial (100/100). A vida é alterada pelo combate e pela comida e salva na conta. Mana ainda não é consumida. As cores vermelha e azul ficam em `.health-bar span` e `.mana-bar span` no CSS; `ui/inventory.js` → `renderVitals()` atualiza os valores e larguras.

`public/js/ui/inventory.js` contém `EQUIPMENT_SLOTS`, com nomes, posições por ordem e desenhos apagados dos espaços vazios. `BACKPACK_ICON` é a arte da mochila. `createInventory()` constrói os slots uma única vez, e `reset()` fecha a mochila a cada entrada/saída do jogo. O botão direito usa o evento `contextmenu` e impede o menu padrão do navegador. Enter/Espaço e a tecla de menu também abrem a mochila quando ela está em foco.

O equipamento usa uma grade de três colunas: colar/elmo/mochila, espada/armadura/escudo, anel/calça/flechas e botas na coluna central. A mochila abre uma grade de quatro colunas e três linhas. `render()` preenche os itens com ícone e quantidade; `renderEquipment()` atualiza os espaços equipados. Nomes e ícones ficam em `items.js`. Itens, equipamentos, banco e skills são salvos na conta pelo servidor.

### Skills e pesca

- `public/js/game/fishing-rules.js`: `FISHING_INTERVAL_MS` (600 ms), `CHALLENGE_DURATION_MS` (1200 ms), `GREEN_START/GREEN_END` (centro entre 40% e 60%), `SALMON_XP` (10) e `salmonChance()` (atualmente 10% + 1 ponto por nível, teto 45%, dobrado pelo acerto). `nearWater()` aceita um tile de distância, inclusive diagonais.
- `public/js/game/progression.js`: `skillProgress()` converte XP total em nível, XP dentro do nível e próximo custo (100, 200, 400...). `ensureProgress()` adiciona os campos às contas antigas sem apagar outfit, senha ou posição.
- `server/fishing.mjs`: verifica margem, intervalo e momento do segundo F; usa RNG no servidor e salva uma captura junto de 10 XP. Os salmões crus empilham em um único slot. O bônus vale até uma captura, quando a barra se reinicia. Movimentar, pausar ou sair interrompe a pesca, sem ganhos offline.
- `public/js/game/fishing.js`: anima o marcador, inicia/para e consulta o servidor. `public/js/ui/skills.js` exibe Pesca, Magia, Culinária e Combate no botão **Skills e níveis**. Magia ganha XP com o dano do cajado; Combate, com o dano da espada.
- `public/styles/skills.css`: aparência do painel, barra vermelha, centro verde e ícone do peixe. A largura da faixa verde vem das constantes compartilhadas.

O banco guarda `skills.fishing.xp`, `skills.magic.xp`, `skills.cooking.xp` e `skills.combat.xp` como **XP total**, além de `inventory` com 12 posições. Magia/Combate preservam frações de 0,5 XP. A API devolve também nível, XP dentro do nível e custo do próximo. A quantidade de peixes/XP nunca é aceita do navegador: somente o servidor concede recompensas. No nível 2, o custo é 200 XP adicionais (300 XP totais), e no nível 3 é 400 adicionais (700 totais).

### Fogão, receitas e Culinária

- `config.js` → `STOVE`: posição do fogão em **(21, 30)**, dentro da casa da cozinha a oeste do templo. `world/map.js` bloqueia o tile, `graphics/stove.js` desenha pedra, chapa, chaminé e fogo, e `game/minimap.js` o marca. Mudar `STOVE` atualiza desenho, colisão e interação juntos.
- `game/actions.js`: decide o que **F** faz pela proximidade: orc no alcance da arma, fogão e pesca, nessa ordem. **Esc** cancela a ação atual, seus ataques e a caminhada automática. `game/game.js` fecha pesca/cozinha ao caminhar ou pausar.
- `game/cooking-rules.js`: `cookingChance()` define 25% + 5 pontos por nível (máximo 100%). `COOKING_INTERVAL_MS` controla os 1200 ms por peixe; `COOKING_XP` define 10 XP por sucesso. `SALMON_RECIPE` liga cru a assado/queimado.
- `server/cooking.mjs`: confirma ingrediente, distância, tempo e espaço; sorteia um resultado por peixe; consome o cru e salva o produto/XP. **Queimados não dão XP.** O servidor também impede preparar e pescar simultaneamente.
- `game/cooking.js` e `styles/cooking.css`: menu com **Cozinhar 1**, **Cozinhar todos**, barra de preparo e **Parar**. `items.js` contém os ícones e nomes de `raw_salmon`, `roasted_salmon` e `burnt_salmon`; `ui/inventory.js` renderiza cada pilha separadamente.
- `game/progression.js` adiciona `skills.cooking.xp` às contas antigas e `ui/skills.js` exibe o progresso. Custos: 100, 200, 400… XP como nas demais skills. Nenhum arquivo de conta precisa ser alterado manualmente.

### Comida, itens no chão e orc

- `game/world-rules.js`: `ORC_SPAWN` define a posição no castelo (86, 26); `ORC_HEALTH` define 300 de vida; as variantes usam `maxHealth` em `MOB_DEFINITIONS` (400, 500 ou 800). `DAMAGE_MIN/MAX` definem 3–6 para orc, espada e mãos vazias. `staffDamage(level)` usa 4–7 + 1 por nível acima do primeiro. `ATTACK_INTERVAL_MS` define 1 segundo entre golpes; `ORC_MOVE_INTERVAL_MS` define 500 ms por passo; `ORC_RESPAWN_MS` define o retorno em 15 segundos. `ensureWorld()` acrescenta os campos às contas antigas e migra a vida proporcional dos orcs para o máximo 10× uma única vez, sem ressuscitar os mortos.
- `server/mobs.mjs`: `tick()` processa perseguição, ataques, morte e retorno ao spawn; o caminho do orc respeita as colisões do mapa. Cada golpe envia coordenadas, dano e `critical` (verdadeiro quando chega a `DAMAGE_MAX`). O jogador derrotado recupera a vida sem perder itens ou XP. O módulo delega comida e transferências para `server/items.mjs`.
- `server/items.mjs`: `use()` cura apenas com `roasted_salmon`; `transfer()` valida origem, proximidade, quantidade, destino e troca de armas antes de alterar os dados. Origens: `inventory`, `equipment`, `ground`, `loot`; destinos: `inventory`, `equipment`, `ground`. Armas não empilham. Os métodos `drop()`, `move()` e `pickup()` reaproveitam a mesma transferência. `element()` valida e salva fogo/água/raio.
- `server/api.mjs`: expõe `world/tick`, `world/attack`, `world/stop`, `world/loot`, `world/heal` e `items/use`, `items/drop`, `items/move`, `items/pickup`, `items/transfer`, `items/element`. A posição também recusa o quadrado de um orc vivo.
- `game/world.js`: consulta o mundo a cada 250 ms, interpola os passos do orc e liga clique/F ao ataque. O botão direito ataca o orc vivo, abre o loot do cadáver ou recolhe uma pilha próxima. Lê o arrasto da mochila e do chão, convertendo a posição do mouse com `renderer.screenToTile()`. `worldRevision` evita aplicar respostas antigas sobre dados mais recentes.
- `ui/inventory.js`: botão direito em uma pilha chama o consumo; `dragstart` transporta slot, tipo e quantidade da pilha arrastada. O servidor confirma esses dados. Os ícones só são recriados quando o conteúdo muda, preservando o arrasto durante a sincronização.
- `graphics/orc.js`: pixel art verde com contorno e quatro direções, além de `drawOrcCorpse()` para o corpo deitado. `graphics/ground-items.js` reutiliza os SVGs de `items.js`; o atributo `xmlns` na raiz permite carregá-los como imagens no canvas. `renderer.js` desenha chão, cadáver, itens e criaturas na ordem visual correta. Nome e barra de vida do orc ficam em HTML, com estilo em `styles/world.css`.
- `ui/damage-numbers.js`: mantém cada número por 1100 ms e faz subir 52 pixels. Usa `renderer.worldToScreen()` para acompanhar a câmera. `.damage-number` é vermelho e `.critical` recebe contorno/brilho amarelos em `styles/world.css`.
- `ui/ground-items.js`: mantém áreas transparentes e arrastáveis sobre cada pilha desenhada no canvas. O arrasto envia apenas o identificador da pilha; o servidor valida origem/destino e quantidade.
- `ui/loot.js`: controla a janela com `ORC_LOOT_CAPACITY` (6 em `game/world-rules.js`) espaços. Renderiza as armas sorteadas, permite arrastar ou recolher pelo botão direito e atualiza ao retirar. `server/mobs.mjs` → `loot()` exige proximidade do cadáver. A janela fecha ao afastar, apertar Esc ou clicar ×.

Vida, mana, pilhas no chão, estado do orc, último cadáver, arma equipada e elemento ficam em `vitals`, `groundItems`, `orc`, `corpse`, `equipment.weapon`, `attackElement` e `worldRevision` na conta. O corpo permanece após o respawn e a próxima morte o substitui. Seu loot é sorteado uma vez e salvo. O chão e o encontro com o orc são individuais por conta neste protótipo. O servidor não aplica golpes acumulados pelo tempo em que o jogo esteve fechado.

### Armas, elementos, XP e controle pelo mouse

- `items.js`: `sword` e `staff` têm `weapon: true`, `stackable: false` e `range: 1/3`. São SVGs próprios em pixel art, usados no equipamento, mochila, loot e chão.
- `server/mobs.mjs` → `hitMob()`: verifica `weaponRange()` e `pathfinding.lineOfSight()`; a seleção continua ativa fora do alcance, retomando os golpes quando o jogador volta. Espada concede dano real × `WEAPON_XP_FACTOR` a Combate; cajado, a Magia. O dano final é limitado à vida restante do orc. Na morte, `ORC_DROP_CHANCE` decide se há arma e um segundo sorteio `< 0.5` escolhe espada ou cajado.
- `ui/staff.js`: botão direito no cajado abre três elementos e equipar/guardar. O elemento pertence ao personagem e é preservado ao trocar de cajado. `ui/element-effects.js` desenha projétil e impacto de 700 ms; `ui/damage-numbers.js` colore o dano conforme o elemento. As classes `.element-fire`, `.element-water` e `.element-lightning` em `styles/world.css` definem as cores.
- `game/navigation.js` e `game/pathfinding.js`: o clique esquerdo encontra um caminho de quatro direções. Setinhas ou Esc cancelam o caminho. `game/world.js` usa a mesma navegação para aproximar no `dragstart` de um item distante, aguarda chegar a um quadrado antes de transferir sem aproximar ao atacar ou usar objetos pelo botão direito. Clicar com o esquerdo no orc não inicia ataque.
- `game/game.js` mantém o ataque enquanto salva cada passo. Respostas do combate atualizam apenas Combate/Magia, preservando o progresso das atividades. O cálculo de níveis em `progression.js` aceita XP fracionário sem arredondar para baixo.

### Templo, botão direito e moedas

- `config.js`: `TEMPLE` define o pátio de **7 × 7 tiles**, centrado em `SPAWN`; o canto inicial é (26, 24). `WELL` alinha a fonte em (29, 25). O fogão foi movido para a casa da cozinha em (21, 30). `world/map.js` → `templeObstacle()` bloqueia somente as quatro colunas dos cantos, sem paredes. `graphics/temple.js` desenha piso, mosaico, colunas e fonte animada. `renderer.js` ordena as peças por profundidade e `objectAt()` reconhece o clique inclusive na parte alta dos sprites da fonte/fogão.
- `server/mobs.mjs` → `heal()`: exige um tile de distância da fonte e restaura os máximos de vida/mana, salvando no banco. Não exige consumir item. `game/world.js` exige proximidade antes de chamar `world/heal`.
- `game/world.js`: botão direito alterna o ataque, usa fonte/fogão/água, abre corpo ou o menu dos itens, sem iniciar caminhada. `actions.interact()` abre diretamente a atividade clicada, sem escolher outra ação pela proximidade do orc. `game/game.js` impede o menu de contexto do navegador em toda a tela do jogo.
- `server/mobs.mjs`: `state.creatures[id].aggro` mantém o alvo do orc durante a perseguição, sem o antigo limite de 7 tiles ao redor do spawn. A busca de caminho respeita o mapa. Parar o ataque do jogador não limpa a perseguição; morte ou pausa/saída limpam o encontro. `attack()` alterna a seleção por padrão; o parâmetro interno `toggle: false` permite selecionar sem alternar.
- `game/world-rules.js`: `COIN_DROP_MIN/MAX` definem **5–15** moedas e `GOLD_PER_SILVER` define **100**. As moedas ficam no segundo slot do loot, sem interferir no sorteio da arma no primeiro. `items.js` contém os ícones `gold_coin` e `silver_coin`, e `ui/loot.js` mostra os contadores.
- `server/items.mjs` → `use()`: botão direito em `gold_coin` troca exatamente 100 por 1 `silver_coin`. Confere espaço antes de consumir, preserva o restante, reutiliza uma pilha cinza existente e aceita o slot liberado por uma pilha de exatamente 100. As moedas usam o inventário e salvamento existentes.

### Elementais, fraquezas e vários alvos

- `game/world-rules.js` → `MOB_DEFINITIONS`: define todos os 16 monstros, com `spawn` incluindo `z` quando estão em outro andar. Orc básico está em (86, 26), elemental de fogo em (53, 126) e de água em (148, 73), longe do templo. `regionalPoint()` aplica o deslocamento do território às coordenadas da definição. `WEAKNESS_MULTIPLIER = 1.5` dá +50%, com `Math.round()`; somente o cajado explora fraquezas.
- `server/mobs.mjs`: o serviço usa `state.targetId` para um único alvo do jogador e `state.creatures[id]` para os tempos de movimento, ataque e perseguição independentes. `hitMob()` aplica fraqueza antes de limitar à vida restante e conceder XP. O critério de crítico acompanha o máximo ajustado. Colisões e caminhos incluem todos os mobs vivos.
- `server/world.mjs` conecta `createMobService()`, `createItemService()`, `createTownService()` e `createGroundCleanup()`. A API `world/attack` recebe `mobId`; sem esse campo, mantém compatibilidade com o orc. `world/loot` usa o identificador do cadáver, e o serviço de itens valida a proximidade daquele cadáver específico.
- `graphics/elemental.js`: fogo e água têm sprites próprios animados e deixam brasa/poça ao morrer. `ui/mobs.js` gerencia nome, HP e fraqueza, incluindo as áreas clicáveis. `renderer.js` ordena todos por profundidade e desloca o rótulo quando ele cobriria o jogador. `game/minimap.js` marca os spawns com verde, vermelho e azul.
- Persistência: `orc` e `corpse` continuam guardando o orc básico para preservar contas antigas. `elementals` guarda as demais criaturas, inclusive os novos orcs, e `elementalCorpses` o último cadáver de cada uma. A API devolve listas `mobs`/`corpses`; `getMobs()` e `getCorpses()` reúnem os dados. Todos reaparecem em 15 segundos e dão moedas; criaturas com `kind: 'orc'` sorteiam armas.

### Mapa ampliado, equipamentos, lojas e banco

#### Banco, dado, zoom e dano dos monstros

- **Clique esquerdo no banco:** `game/world.js` usa `navigation.goTo()` até um quadrado do cofre e abre o painel. O botão direito continua exigindo proximidade, sem caminhar.
- **Clique esquerdo em itens do banco:** `ui/town.js` → `renderSlots()` seleciona a pilha e chama `deposit` ou `withdraw` imediatamente com sua quantidade inteira. `ui/inventory.js` encaminha o clique da mochila lateral para `depositItem()` quando o banco está aberto. Shift + esquerdo é interceptado por `ui/inspection.js` e só mostra Olhar. Quantidade parcial permanece suportada pela API; o painel do banco usa transferência de pilhas inteiras.
- **Cozinha ao norte:** `world/map.js` → `houses` define `entrance: 'north'`. `houseDoor()` e `houseWall()` compartilham essa orientação com `graphics/scenery.js`, que abre a parede norte, fecha a sul e move a prateleira para o fundo. `connectingRoad()` define os caminhos para cozinha e banco.
- **Atributos:** `items.js` define `atk: 1` no cajado, `atk: 2` na espada e `arm: 1` nos equipamentos de proteção criados por `equipment()`. `game/look-rules.js` → `lookItem()` lê os valores diretamente do catálogo, incluindo para itens antigos. Os valores são exibidos em Olhar; a fórmula de combate existente permanece separada em `server/mobs.mjs`.

- `game/town-rules.js`: `BANK_HALL` define o salão em (31, 34); `DICE_ALCOVE`, o canto de apostas de Dário em (38, 36). Os quatro pontos de `TOWN_POINTS` com `kind: 'bank'` acessam o mesmo `account.bank`. `world/map.js` inclui o salão nas casas e liga a entrada norte à estrada principal. O centro não tem mais mosaico ou placa de doação.
- `graphics/scenery.js` → `drawBankInterior()` desenha o salão. `game/renderer.js` desenha os interiores antes dos itens no chão para que o piso não esconda os itens. `graphics/town.js` desenha os bancos e Dário.
- `TOWN_POINTS.dice` posiciona Dário. A rota `town/bet` chama `server/town.mjs` → `bet()`: valida proximidade, piso, valor inteiro e ouro na mochila, desconta a aposta e sorteia 1–6 com `crypto.randomInt`. Baixo ganha em 1–3; alto, em 4–6. Acertar devolve duas vezes a aposta. `account.diceHistory` guarda os últimos 20 resultados e seus identificadores para impedir cobrança duplicada em requisições repetidas. `ui/town.js` monta o painel e usa um identificador novo por aposta.
- `game/renderer.js` → `setZoom()` altera a escala do mundo de 1 a 4, mantendo pixels inteiros. `screenToTile()`, `worldToScreen()` e `objectAt()` usam essa escala para os cliques e objetos continuarem alinhados.
- `game/minimap.js` → `minimapView()` limita a janela ampliada; `minimapTile()` converte o clique em coordenadas reais. `game/game.js` liga botões, roda do mouse e navegação até o destino; zoom 1× mostra o mundo todo e 8× aproxima a área do jogador.
- `game/world-rules.js` → `MOB_DEFINITIONS`: `damageMin`, `damageMax` e `attackIntervalMs` controlam cada criatura. Draco e todos os monstros de água usam **1 / 1 / 5000**. `server/mobs.mjs` aplica esse intervalo por criatura; as demais usam `ATTACK_INTERVAL_MS` como padrão.
- `world/elevation.js` → `WORLD_LAYOUT_VERSION` força a migração das posições antigas. `ensureWorld()` também remove IDs desconhecidos e reposiciona mobs dentro da zona segura. `config.js` → `GAME_VERSION` identifica a versão compartilhada; `api.js` impede entrar se o servidor ainda estiver executando outra versão. Reinicie com **Ctrl+C → `npm.cmd run dev` → Ctrl+F5**.

- `config.js`: mundo de **192 × 168 tiles**. `FIRE_REGION` começa em (35, 100), `WATER_REGION` em (139, 54) e `world/elevation.js` → `ORC_REGION` em (76, 8), afastados da vila. `REGION_OFFSETS` desloca os desenhos locais dos territórios, seus monstros e suas passagens. Ao reposicionar um bioma, ajuste seus limites, deslocamento e ligação das estradas em `world/map.js` → `connectingRoad()`. `tileAt(x, y, z)` e `walkable(x, y, z)` usam o mesmo piso no navegador e no servidor.
- `game/world-rules.js` → `MOB_DEFINITIONS`: seis novas criaturas possuem `variant`, `damageMin`, `damageMax`, HP e fraqueza próprios. `graphics/elemental.js` usa variantes `guardian`, `wisp`, `drake` e `serpent` para distinguir os desenhos. Os três inimigos antigos foram preservados.
- `items.js` → `ITEMS`: inclui os conjuntos de couro/ferro, escudos, colares, anéis e flechas. `equipmentSlot` decide onde equipar, `stackable` decide se empilha e `category` separa alimento, equipamento e moeda. `server/items.mjs` valida os espaços e trocas; `ui/inventory.js` renderiza todos os slots. Armaduras/acessórios ainda não possuem bônus de combate.
- `game/town-rules.js` → `TOWN_POINTS`: posição única compartilhada pelo cenário, colisão, clique, minimapa e servidor. Para mover um vendedor, altere apenas a coordenada aqui. `graphics/town.js` desenha os balcões e banco; `renderer.js` inclui os objetos e reconhece cliques na parte alta dos sprites.
- `shopStock()` deriva o estoque do catálogo e fixa o preço em **1 ouro por unidade**. `server/town.mjs` aplica o mesmo valor na compra/venda; para mudar preços, atualize também a cobrança e os textos de `ui/town.js`. Moedas não são mercadoria. A loja de alimentos começa com salmões, sem poções.
- `server/api.mjs`: rotas `town/open`, `town/buy`, `town/sell`, `town/deposit`, `town/depositAll` e `town/withdraw`. O servidor exige distância de até um tile, quantidade inteira positiva, origem válida, saldo e espaço. A transação é planejada em cópias e só então aplicada/salva, evitando perda de itens se a mochila ou banco estiver cheio. `depositAll()` testa todos os itens antes de esvaziar a mochila: se algum não couber, recusa tudo sem perda.
- `account.bank` tem **48 slots**, separados da mochila. `ensureTown()` migra contas antigas. `ui/town.js` mantém a seleção, quantidade e ações; `game/world.js` exige proximidade, abre o painel e fecha ao afastar-se. O depósito é pessoal e persiste em `data/game.json`.
- `ui/town.js` → `renderSlots()`: botão direito deposita/retira a pilha inteira. `depositItem()` também recebe os cliques da mochila lateral via `ui/inventory.js` → `onDeposit`, somente quando o banco está aberto; fora dele, comer/equipar mantém o comportamento normal. O botão **Guardar toda a mochila** chama `town/depositAll`. Equipamentos vestidos não são incluídos.
- `game/minimap.js` → `MINIMAP_MARKERS` e `MINIMAP_LEGEND`: ícones de pesca, templo, fogão, lojas e banco. `world/map.js` → `FISHING_SPOTS` contém as margens sugeridas; pescar continua permitido junto a qualquer água.

### Andares, fortaleza e zona protegida

- `config.js` → `SAFE_ZONE`: retângulo de **30 × 30 tiles** ao redor do spawn. `world/elevation.js` → `isSafeZone()` é a regra compartilhada. `server/mobs.mjs` impede entrar nessa área, adquirir alvos e causar dano nela; ataques do jogador também são bloqueados dentro dela. O minimapa desenha o contorno azul e a legenda do piso informa quando está na área protegida.
- `world/elevation.js`: concentra `ORC_CASTLE`, `MOUNTAINS`, `CAVES`, `FLOOR_LINKS` e `REGION_OFFSETS`. `regionalPoint()` desloca coordenadas locais para o mapa ampliado. O castelo possui portão sul e piso superior em formato de muralha. `floorOf()` trata a ausência de `z` em dados antigos como superfície 0; `sameFloor()` impede interações entre pisos diferentes.
- Cada passagem de `FLOOR_LINKS` tem `from: {x, y, z}` e `to: {x, y, z}`. Pisos válidos: **0**, **+1** e **-1**. `transitionAt()` localiza uma passagem; `Movement.update()` a usa ao pisar no tile e muda jogador/câmera imediatamente. A chegada é diferente da saída para não criar um ciclo de teleporte. Há uma escada de retorno em todas as áreas.
- `server/api.mjs` valida a posição com seu `z` e `validFloorMove()` exige uma passagem legítima para mudar de andar. O piso é salvo em `account.position.z`. `game/game.js` inclui o piso na chave de salvamento, cancela a navegação ao atravessar uma passagem e atualiza o minimapa. `world.js` limpa as janelas e efeitos ao trocar de piso.
- `server/items.mjs` grava `z` nos itens largados e valida o piso de origem/destino antes de mover ou empilhar. `server/mobs.mjs` mantém piso nos monstros, cadáveres e eventos de dano. Distância entre pisos diferentes é infinita; ataque, pesca, fogão, banco e loot respeitam essa separação. Monstros não atravessam escadas e buracos.
- `renderer.js` desenha só o piso atual, incluindo os cenários de superfície apenas no andar 0. `graphics/terrain.js` contém rochedo, caverna, muralha, escada e buraco. `graphics/elevation.js` desenha as quatro torres, bandeiras e portão. `minimap.js` refaz o fundo ao mudar de piso e mostra somente os marcadores daquele andar.
- `game/world-rules.js` → `ensureWorld()`: `WORLD_LAYOUT_VERSION` reposiciona mobs de contas antigas para os novos territórios sem apagar itens, banco, vida ou XP. Qualquer criatura salva dentro da área protegida também é devolvida ao seu spawn. Cadáveres antigos e seu loot são preservados.

### Limpeza automática dos itens no chão

`game/world-rules.js` → `GROUND_CLEANUP_INTERVAL_MS` define **15 minutos**. `server/ground-cleanup.mjs` usa `account.nextGroundCleanupAt`, persistido no JSON, para manter o ciclo mesmo após reiniciar. `sweep()` esvazia `groundItems`, avança a próxima data pelo número de ciclos vencidos e incrementa `worldRevision`; mochila, equipamento e banco são preservados. Os cadáveres seguem o prazo individual de **2 minutos** de `expiresAt`, verificado pelo mesmo serviço, inclusive para contas offline.

`server/api.mjs` executa a limpeza a cada segundo para todas as contas, mesmo desconectadas, e também antes das ações autenticadas. `server/world.mjs` aplica a mesma regra no tick; mover itens não reinicia a contagem. Contas antigas recebem um primeiro prazo sem perder seus objetos imediatamente. Alterar o intervalo não muda um prazo já salvo: ele será usado nos ciclos seguintes. Os testes usam relógio simulado para verificar 15 minutos sem precisar esperar esse tempo real.

### Caminhar mais devagar

Em `public/js/config.js`:

```js
export const STEP_DURATION_MS = 220;
```

O número representa a duração de um passo em milissegundos. Quanto maior, mais devagar. A mesma configuração controla a interpolação visual e o intervalo entre os passos.

### Entender as coordenadas

O canto superior esquerdo do mapa é `(0, 0)`. `x` aumenta para a direita; `y` aumenta para baixo. Cada tile mede 32 × 32 pixels de arte. Com `WORLD_SCALE = 2`, ele aparece com 64 × 64 pixels CSS na tela. A posição mostrada no jogo é a coordenada do tile.

### Mover ou adicionar uma casa

Em `public/js/world/map.js`, a lista `houses` contém objetos como:

```js
{ x: 23, y: 17, w: 6, h: 5, roof: 'red' }
```

Isso coloca uma casa em `(23, 17)`, ocupando 6 tiles de largura e 5 de altura. `roof` aceita `'red'` ou `'blue'`. Acrescente `interior: true` para uma casa aberta em corte, como as três atuais. `houseAt()` identifica a casa, `houseDoor()` centraliza a entrada na parede sul e `houseWall()` bloqueia somente as paredes. Mudar a lista atualiza a imagem, a colisão e o minimapa. Evite sobrepor a casa ao `SPAWN`, ao poço ou ao lago.

`graphics/scenery.js` → `drawHouseInterior()` desenha piso, paredes e prateleira; `renderer.js` desenha esse cenário antes dos personagens para não cobri-los com o piso. `TOWN_POINTS` em `game/town-rules.js` posiciona **Rafhi (25, 19)** e **Matlo (36, 22)** dentro de casas diferentes. A casa em (18, 29) é a cozinha, com `STOVE` em (21, 30). Para mover uma casa, ajuste também seu morador/fogão e preserve uma entrada caminhável.

### Colocar um trecho de cascalho

Em `tileAt()`, antes da regra geral do chão:

```js
if (x >= 12 && x <= 18 && y >= 20 && y <= 23) return 'gravel';
```

Os tipos são `'stone'` (praça), `'cobble'` (ruas), `'gravel'` (pedregulhos), `'grass'`, `'water'`, `'ash'` (cinzas), `'obsidian'`, `'lava'`, `'sand'`, `'bridge'` e `'void'` (fora do mundo). **A primeira regra que corresponder vence.** As regiões e estradas são verificadas antes da vila. As texturas ficam em `graphics/terrain.js`; o mapa decide o tipo do terreno e esse outro arquivo decide sua aparência.

### Trocar a cor inicial da roupa

Em `config.js`, `DEFAULT_OUTFIT.body` é um **índice de COLORS**, começando em zero:

```js
export const DEFAULT_OUTFIT = {
  type: 'citizen',
  head: 1,
  body: 7, // Azul, o oitavo item de COLORS.
  legs: 15,
  feet: 15,
};
```

Esse padrão vale para novas escolhas; personagens existentes mantêm as cores salvas. Para adicionar cores, acrescente o código hexadecimal ao fim de `COLORS` e o nome correspondente ao fim de `COLOR_NAMES`. Preserve a ordem das cores existentes, porque o banco guarda os índices.

### Detalhar um outfit

Em `graphics/character.js`, `drawCitizen()`, `drawMage()` e `drawWarrior()` desenham seus acessórios; `drawFace()`, `drawBody()`, `drawLegs()` e `drawArms()` desenham as partes comuns. `avatarSprite()` monta as camadas e aplica o contorno final.

O desenho cabe em **32 × 40 pixels**. `rect(ctx, cor, x, y, largura, altura)` pinta um retângulo; `pixels(ctx, cor, [[x,y], ...])` pinta um polígono com bordas sem suavização; `shade(cor, valor)` clareia com valores positivos e escurece com negativos. `palette.head/body/legs/feet` traz as cores escolhidas pelo jogador. Um detalhe dourado pode ser acrescentado com:

```js
rect(ctx, '#d9bc73', 15, 23 + bob, 2, 1);
```

`bob` faz o tronco oscilar ao caminhar. Os sentidos são `'down'`, `'up'`, `'left'` e `'right'`; a direita espelha o desenho lateral. `step` vale 0 em repouso e alterna 1/2 ao caminhar. Ao editar um outfit, confira os quatro sentidos com os botões de girar da prévia, além da caminhada no jogo.

### Mudar a fonte do nome

Em `public/styles/game.css`, procure `.player-label` e altere `font` e `color`. O nome é um elemento HTML separado do canvas: isso evita ampliar letras de baixa resolução. O canvas cuida apenas da pixel art. Preserve `pointer-events: none` para que o nome não capture cliques.

## Como as partes se conectam

`index.html` carrega `app.js`. Ele conecta o formulário (`ui/auth.js`) à sessão de jogo (`game/game.js`). Durante o jogo, `input.js` lê a setinha, `movement.js` consulta a colisão de `world/map.js`, e `renderer.js` desenha a câmera e os sprites. O nome é posicionado em HTML por cima do canvas. O salvamento chama `api.js`, que envia a posição ao servidor.

O servidor também importa `world/map.js` e `config.js` para validar o terreno e o outfit. Esses arquivos não dependem de navegador: mantenha-os sem `document` ou `window`. Desenhos e eventos de interface ficam nos outros módulos.

## Verificar e manter a organização

```powershell
npm test               # Cadastro, sessão, colisão e persistência após reinício
npm run test:browser   # Fluxo real de login, outfits, movimento e câmera
npm run format         # Organiza indentação e quebras de linha
npm run format:check   # Confere a formatação sem modificar arquivos
```

Se for configurar o projeto em outro computador, rode `npm install` e `npx playwright install chromium` antes do teste de navegador. Para apenas jogar, basta ter Node.js 22+ e executar `npm start`.

## Seus dados

`data/game.json` é criado automaticamente e contém contas e mundo compartilhado. A seção multiplayer no início deste guia explica a migração de `accounts.json`, a separação de dados e o backup. Não é necessário alterar os salvamentos para editar o cenário.

Os testes usam contas separadas em pastas temporárias ou `test-results/browser-data`; não alteram suas contas de jogo. `test-results/screenshots` contém capturas de verificação e não faz parte da arte utilizada pelo jogo.

## Referência visual

O calçamento, as silhuetas e os contornos usam como referência a estética das cidades clássicas, como nas [capturas de Greenshore da Tibia Wiki](https://www.tibiawiki.com.br/wiki/Arquivo%3ATibia_25_Anos_Time_Tourist_Greenshore.png). Os desenhos deste projeto continuam sendo próprios e editáveis em código.
