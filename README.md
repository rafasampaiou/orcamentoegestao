# Tauá Budget Pro

Plataforma avançada de gestão orçamentária para controle de Realizado vs Orçado, Gestão de Mão de Obra e Análise de Ocupação.

## Funcionalidades Principais

- **Dashboard Real**: Acompanhamento de indicadores financeiros em tempo real.
- **Gestão de Versões**: Controle de múltiplos cenários de planejamento (Orçamentos e Versões).
- **Mão de Obra**: Parâmetros detalhados de CLT, encargos e benefícios.
- **Integração Supabase**: Persistência de dados segura e escalável.
- **Vercel Deploy Ready**: Configurado para deploy contínuo.

## Como Rodar Localmente

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configure Variáveis de Ambiente**:
   Crie um arquivo `.env` com as seguintes chaves (use as de produção ou um projeto de teste do Supabase):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. **Inicie o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```

## Deploy na Vercel

1. **Conecte seu repositório GitHub** na Vercel.
2. **Configure as Variáveis de Ambiente** na aba "Environment Variables" do projeto na Vercel.
3. O build será automático via script `npm run build`.

---
Desenvolvido por **Rafael Souza**.
