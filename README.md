# 365 dias de gratidão

Web app (PWA) para iPhone e Android: todos os dias, alguns minutos para agradecer a Deus.
Desenvolvido por Jhony Beraldo.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | App do participante |
| `admin.html` | Painel master (só administrador) |
| `css/app.css` | Visual do app |
| `css/admin.css` | Visual do painel |
| `js/config.js` | Chaves do Supabase |
| `js/dados.js` | Os 365 dias do arquivo de conteúdo + dia de exemplo |
| `js/arvore-dados.js` | Desenho da árvore da gratidão |
| `js/comum.js` | Funções compartilhadas (datas, árvore, imagens para Stories/WhatsApp) |
| `js/app.js` | Telas e regras do app |
| `js/admin.js` | Telas e regras do painel |
| `manifest.webmanifest`, `sw.js`, `icons/` | Instalação na tela inicial e uso offline |
| `supabase.sql` | Banco de dados, segurança e regras |
| `.github/workflows/manter-supabase-ativo.yml` | Mantém o Supabase ativo (segunda e quinta, automático) |
| `.github/keepalive/ultima-execucao.txt` | Registro da última execução (atualizado sozinho) |

## Passo a passo

1. **Supabase**: crie um projeto novo.
2. **SQL Editor**: cole e rode todo o `supabase.sql`.
3. **Authentication → Sign In / Providers → Email**: desative **Confirm email**.
   O login é por usuário; internamente vira `usuario@gratidao365.app` e nenhum e-mail é enviado.
4. **Project Settings → API**: copie a *Project URL* e a chave *anon public* para `js/config.js`.
5. **GitHub**: suba todo o conteúdo da pasta para a raiz do repositório (inclusive a pasta oculta `.github`) → Settings → Pages → branch `main` / pasta raiz.
6. **Sua conta de administrador**: abra o app, crie sua conta (ex.: usuário `jhony`) e rode no SQL Editor:
   ```sql
   update public.perfis set is_admin = true where usuario = 'jhony';
   ```
7. **Painel master**: acesse `seu-endereco/admin.html` (ou pelo menu ☰ do app → Painel master).
   Em *Configurações*, confira a data de lançamento (01/01/2027) e preencha o link de cadastro.

## Manter o Supabase sempre ativo

O plano gratuito do Supabase pausa projetos sem atividade por 7 dias. Para evitar isso, o repositório já vem com um
agendamento do GitHub Actions que consulta o banco toda **segunda e quinta às 9h** (horário de Brasília).

Configuração (uma vez só):
1. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Crie o secret `SUPABASE_URL` com a *Project URL* (a mesma do `js/config.js`).
3. Crie o secret `SUPABASE_ANON_KEY` com a chave *anon public* (a mesma do `js/config.js`).
4. Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions** e salve.
5. Na aba **Actions**, abra **Manter Supabase ativo** → **Run workflow** para testar. Deve ficar verde.

Cada execução atualiza o arquivo `.github/keepalive/ultima-execucao.txt`. Isso mantém o repositório ativo
(o GitHub desliga agendamentos de repositórios parados há 60 dias) e serve para você conferir a última execução.
Se uma execução ficar vermelha, o GitHub envia um e-mail avisando.

## Regras que o app segue

- **Antes da data de lançamento**: cadastro aberto, contagem regressiva, dia de exemplo e convite.
- **Início do percurso (regra mista)**: quem se cadastrou até o dia anterior ao lançamento começa junto com o grupo, na data de lançamento. Quem se cadastrar depois começa no primeiro dia que marcar como concluído.
- **Sequência obrigatória**: o início sempre mostra o próximo dia a fazer; só avança ao tocar em *Marcar dia como concluído*; nunca passa do dia de hoje. As mesmas regras também são conferidas no banco.
- **Releitura**: Progresso → toque no mês → dias concluídos em modo de leitura.
- **Árvore da gratidão**: uma folha por dia concluído, folha dourada a cada 30 dias, completa no Dia 365.

## Instalar no celular

- **iPhone (Safari)**: abra o link → botão Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome)**: abra o link → menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*).

## Compartilhar

As imagens (1080 × 1920) são geradas no próprio celular. Os botões abrem a tela de compartilhar do aparelho
(Instagram, WhatsApp etc.). Quando o aparelho não permite enviar imagem e texto juntos, use *Copiar mensagem* no convite.

## Esqueceu a senha

1. Na tela de login, a pessoa toca em **Esqueci minha senha**: abre o WhatsApp (44) 98437-3004 com a mensagem
   "Olá, esqueci a senha do 365 dias de gratidão. Meu usuário é …" já preenchida.
2. Você abre o painel master → *Participantes* → *Redefinir senha*, define a nova senha e envia para a pessoa.

O número pode ser trocado no painel master → *Configurações* → *WhatsApp para pedidos de senha*.

## Ao publicar uma atualização

Aumente a versão em `sw.js` (`g365-v1` → `g365-v2`) para os celulares baixarem os arquivos novos.
