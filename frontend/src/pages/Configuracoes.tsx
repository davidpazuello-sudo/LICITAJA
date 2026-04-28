import { type ReactNode, useEffect, useState } from "react";

import { useConfiguracaoIA, usePncp, usePortalIntegracoes } from "../hooks/useConfiguracoes";
import type { IAProviderConfig, PortalIntegracaoCreateInput, PortalIntegracaoType } from "../types/configuracao.types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { Tabs } from "../components/ui/Tabs";

// Modelos predefinidos por provedor de IA.
// Adicione novos modelos aqui conforme forem lançados.
const MODELOS_POR_PROVIDER: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
    { value: "o3", label: "o3" },
    { value: "o4-mini", label: "o4-mini" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { value: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
    { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
  ],
  gemini: [
    { value: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash (preview)" },
    { value: "gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro (preview)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat (V3)" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
  ],
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile)" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Instant)" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
  ],
};

const MODELO_PERSONALIZADO = "__personalizado__";

const configTabs = [
  { id: "portais", label: "Portais de Licitacao" },
  { id: "ia", label: "Inteligencia Artificial" },
];

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapsiblePanel(props: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { title, defaultOpen = false, children, actions } = props;
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl bg-panel p-4">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-slate/60">{title}</p>
        <div className="flex items-center gap-3 text-slate">
          {actions}
          <ChevronIcon isOpen={isOpen} />
        </div>
      </button>

      {isOpen ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: "conectado" | "erro" | "nao_testado" }) {
  if (status === "conectado") return <Badge variant="green">Conectado</Badge>;
  if (status === "erro") return <Badge variant="amber">Erro</Badge>;
  return <Badge variant="slate">Nao testado</Badge>;
}

function PortalActiveBadge({ status }: { status: "conectado" | "erro" | "nao_testado" }) {
  return <Badge variant={status === "conectado" ? "green" : "slate"}>{status === "conectado" ? "Ativo" : "Inativo"}</Badge>;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const portalAuthOptions: Array<{ value: PortalIntegracaoCreateInput["tipo_auth"]; label: string }> = [
  { value: "none", label: "Sem autenticacao" },
  { value: "token", label: "Token / API Key" },
  { value: "x-api-key", label: "Header X-API-KEY" },
  { value: "basic", label: "Usuario e senha" },
];

const portalStatusOptions: Array<{ value: PortalIntegracaoCreateInput["status"]; label: string }> = [
  { value: "ativa", label: "Ativa" },
  { value: "inativa", label: "Inativa" },
];

function PortalStatusSwitch(props: {
  checked: boolean;
  isLoading?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { checked, isLoading = false, onChange } = props;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Desativar integracao" : "Ativar integracao"}
      disabled={isLoading}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-8 w-[68px] shrink-0 items-center rounded-full border transition ${
        checked ? "border-emerald-400 bg-emerald-400" : "border-rose-400 bg-rose-500"
      } ${isLoading ? "cursor-wait opacity-70" : "hover:opacity-90"}`}
    >
      <span
        className={`absolute flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow transition-transform ${
          checked ? "translate-x-[38px] text-emerald-500" : "translate-x-[2px] text-rose-500"
        }`}
      >
        {checked ? "✓" : "×"}
      </span>
    </button>
  );
}

function PortalCard({
  portal,
  isToggling,
  onToggleStatus,
}: {
  portal: PortalIntegracaoType;
  isToggling: boolean;
  onToggleStatus: (portalId: number, nextStatus: "ativa" | "inativa") => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="p-6">
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M12 4h8v16H4V4h8M9 8h6M9 12h6M9 16h4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="font-semibold text-ink">{portal.nome}</p>
          </div>

          <div className="flex items-center gap-3">
            <PortalStatusSwitch
              checked={portal.status === "ativa"}
              isLoading={isToggling}
              onChange={(checked) => onToggleStatus(portal.id, checked ? "ativa" : "inativa")}
            />
            <Badge variant={portal.status === "ativa" ? "green" : "slate"}>
              {portal.status === "ativa" ? "Ativo" : "Inativo"}
            </Badge>
            <ChevronIcon isOpen={isOpen} />
          </div>
        </button>

        {isOpen ? (
          <div className="grid gap-4 border-t border-line/70 pt-5 md:grid-cols-2">
            <div className="rounded-2xl bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate/60">URL base</p>
              <code className="mt-2 block break-all text-sm text-ink">{portal.url_base}</code>
            </div>
            <div className="rounded-2xl bg-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate/60">Autenticacao</p>
              <p className="mt-2 text-sm text-ink">
                {portal.tipo_auth === "none"
                  ? "Sem autenticacao"
                  : portal.tipo_auth === "token" || portal.tipo_auth === "api_key" || portal.tipo_auth === "x-api-key"
                    ? "Token / API Key"
                    : "Usuario e senha"}
              </p>
              {portal.credencial_masked ? (
                <p className="mt-1 text-xs text-slate/80">Credencial: {portal.credencial_masked}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function TabPortais() {
  const { config, status, errorMessage, isTesting, testeResult, isSavingUrl, isTogglingStatus, testar, salvarUrl, alternarStatus } = usePncp();
  const {
    items: portalItems,
    status: portalStatus,
    errorMessage: portalErrorMessage,
    isCreating,
    togglingPortalId,
    criarPortal,
    alternarPortal,
  } = usePortalIntegracoes();
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showPortalDetails, setShowPortalDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [formData, setFormData] = useState<PortalIntegracaoCreateInput>({
    nome: "",
    url_base: "",
    tipo_auth: "none",
    credencial: "",
    status: "ativa",
  });

  const handleEditUrl = () => {
    setUrlInput(config?.url_base ?? "");
    setEditingUrl(true);
  };

  const handleSalvarUrl = async () => {
    if (!urlInput.trim()) return;
    await salvarUrl(urlInput.trim());
    setEditingUrl(false);
  };

  const handleFormChange = <Key extends keyof PortalIntegracaoCreateInput>(
    field: Key,
    value: PortalIntegracaoCreateInput[Key],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleOpenCreateModal = () => {
    setCreateErrorMessage("");
    setFormData({
      nome: "",
      url_base: "",
      tipo_auth: "none",
      credencial: "",
      status: "ativa",
    });
    setShowCreateModal(true);
  };

  const handleCreatePortal = async () => {
    if (!formData.nome.trim() || !formData.url_base.trim()) {
      setCreateErrorMessage("Preencha pelo menos o nome do portal e a URL base.");
      return;
    }

    try {
      await criarPortal({
        ...formData,
        nome: formData.nome.trim(),
        url_base: formData.url_base.trim(),
        credencial: formData.credencial.trim(),
      });
      setShowCreateModal(false);
    } catch (err) {
      setCreateErrorMessage(err instanceof Error ? err.message : "Nao foi possivel criar a integracao.");
    }
  };

  const handleTogglePncp = async (nextStatus: "ativa" | "inativa") => {
    setCreateErrorMessage("");
    try {
      await alternarStatus(nextStatus);
    } catch (err) {
      setCreateErrorMessage(err instanceof Error ? err.message : "Nao foi possivel atualizar o PNCP.");
    }
  };

  const handleTogglePortal = async (portalId: number, nextStatus: "ativa" | "inativa") => {
    setCreateErrorMessage("");
    try {
      await alternarPortal(portalId, nextStatus);
    } catch (err) {
      setCreateErrorMessage(err instanceof Error ? err.message : "Nao foi possivel atualizar a integracao.");
    }
  };

  if (status === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-4 p-8">
          <Spinner size="lg" className="text-accent" />
          <p className="text-sm text-slate">Carregando configuracao...</p>
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="border-rose-100 bg-rose-50/70">
        <div className="p-6">
          <p className="text-sm font-semibold text-rose-800">Backend indisponivel</p>
          <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
        </div>
      </Card>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-ink">Portais de Licitacao</h2>
          <p className="mt-1 text-sm text-slate">Integracoes ativas com portais oficiais de licitacao publica.</p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button variant="secondary" onClick={handleOpenCreateModal}>
            <PlusIcon />
            Nova integracao
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setShowPortalDetails((value) => !value)}
            className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-accent" aria-hidden="true">
                  <path
                    d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="font-semibold text-ink">PNCP - Portal Nacional de Contratacoes Publicas</p>
            </div>

            <div className="flex items-center gap-3">
              <PortalStatusSwitch
                checked={config.integracao_status === "ativa"}
                isLoading={isTogglingStatus}
                onChange={(checked) => handleTogglePncp(checked ? "ativa" : "inativa")}
              />
              <Badge variant={config.integracao_status === "ativa" ? "green" : "slate"}>
                {config.integracao_status === "ativa" ? "Ativo" : "Inativo"}
              </Badge>
              <ChevronIcon isOpen={showPortalDetails} />
            </div>
          </button>

          {showPortalDetails ? (
            <div className="space-y-5 border-t border-line/70 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate/70">Integracao nativa - API publica - Sem autenticacao</p>
                <StatusBadge status={config.status} />
              </div>

              <p className="text-sm leading-6 text-slate">{config.descricao}</p>

              <CollapsiblePanel
                title="URL base da API"
                actions={
                  !editingUrl ? (
                    <span className="shrink-0 text-xs font-medium text-accent transition hover:text-accentDark">Editar</span>
                  ) : null
                }
              >
                {editingUrl ? (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                    />
                    <Button size="sm" isLoading={isSavingUrl} onClick={handleSalvarUrl}>
                      Salvar
                    </Button>
                    <button
                      type="button"
                      className="rounded-xl border border-line px-3 text-sm text-slate transition hover:text-ink"
                      onClick={() => setEditingUrl(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-sm text-ink">{config.url_base}</code>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-accent transition hover:text-accentDark"
                      onClick={handleEditUrl}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </CollapsiblePanel>

              <CollapsiblePanel title="Endpoints utilizados">
                <div className="space-y-1.5 font-mono text-sm text-slate">
                  <p>
                    <span className="text-accent/80">GET</span> /contratacoes/proposta
                  </p>
                  <p>
                    <span className="text-accent/80">GET</span> /contratacoes/publicacao
                  </p>
                </div>
              </CollapsiblePanel>

              {testeResult ? (
                <div
                  className={`rounded-2xl p-4 text-sm ${
                    testeResult.status === "conectado"
                      ? "border border-emerald-100 bg-emerald-50"
                      : "border border-rose-100 bg-rose-50"
                  }`}
                >
                  {testeResult.status === "conectado" ? (
                    <p className="font-medium text-emerald-800">
                      Conectado com sucesso
                      {testeResult.latencia_ms !== null ? ` - ${testeResult.latencia_ms} ms` : ""}
                    </p>
                  ) : (
                    <>
                      <p className="font-medium text-rose-800">Falha na conexao</p>
                      {testeResult.erro_mensagem ? <p className="mt-1 text-rose-700">{testeResult.erro_mensagem}</p> : null}
                    </>
                  )}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <Button variant="outline" isLoading={isTesting} onClick={testar}>
                  {isTesting ? "Testando..." : "Testar conexao"}
                </Button>
                {config.status !== "nao_testado" && !testeResult ? (
                  <p className="text-xs text-slate/70">
                    Ultimo status:{" "}
                    <span className={config.status === "conectado" ? "text-emerald-700" : "text-rose-700"}>
                      {config.status}
                    </span>
                    {config.erro_mensagem ? ` - ${config.erro_mensagem}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {portalStatus === "error" ? (
        <Card className="border-rose-100 bg-rose-50/70 p-6">
          <p className="text-sm font-semibold text-rose-800">Nao foi possivel carregar as integracoes adicionais.</p>
          <p className="mt-1 text-sm text-rose-700">{portalErrorMessage}</p>
        </Card>
      ) : null}

      {portalItems.length ? (
        <div className="space-y-4">
          {portalItems.map((portal) => (
            <PortalCard
              key={portal.id}
              portal={portal}
              isToggling={togglingPortalId === portal.id}
              onToggleStatus={handleTogglePortal}
            />
          ))}
        </div>
      ) : null}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Cadastrar novo portal">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-slate">
            Cadastre um novo portal de licitacao para centralizar a configuracao dentro do LicitaAI.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Nome do portal</span>
              <input
                value={formData.nome}
                onChange={(event) => handleFormChange("nome", event.target.value)}
                placeholder="Ex.: Petronect"
                className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink">URL base</span>
              <input
                type="url"
                value={formData.url_base}
                onChange={(event) => handleFormChange("url_base", event.target.value)}
                placeholder="https://portal.exemplo.com/api"
                className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Autenticacao</span>
              <select
                value={formData.tipo_auth}
                onChange={(event) => handleFormChange("tipo_auth", event.target.value as PortalIntegracaoCreateInput["tipo_auth"])}
                className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              >
                {portalAuthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Status inicial</span>
              <select
                value={formData.status}
                onChange={(event) => handleFormChange("status", event.target.value as PortalIntegracaoCreateInput["status"])}
                className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              >
                {portalStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Credencial</span>
              <input
                value={formData.credencial}
                onChange={(event) => handleFormChange("credencial", event.target.value)}
                placeholder={
                  formData.tipo_auth === "basic"
                    ? "usuario:senha"
                    : formData.tipo_auth === "token"
                      ? "Cole o token ou API key"
                      : "Opcional"
                }
                className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              />
              <p className="mt-1 text-xs text-slate/70">
                Para autenticacao basica, use o formato <code>usuario:senha</code>.
              </p>
            </label>
          </div>

          {createErrorMessage ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {createErrorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button isLoading={isCreating} onClick={handleCreatePortal}>
              Criar integracao
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface IAProviderCardProps {
  provider: IAProviderConfig;
  saveIndicator: "idle" | "saving" | "saved";
  promptSaveIndicator: "idle" | "saving" | "saved";
  isActivating: boolean;
  onSave: (providerId: string, update: { modelo?: string; api_key?: string }) => Promise<void>;
  onActivate: (providerId: string) => Promise<void>;
  onPromptChange: (providerId: string, prompt: string) => void;
}

function IAProviderCard({
  provider,
  saveIndicator,
  promptSaveIndicator,
  isActivating,
  onSave,
  onActivate,
  onPromptChange,
}: IAProviderCardProps) {
  const modelosPredefinidos = MODELOS_POR_PROVIDER[provider.id] ?? [];
  const isModeloPredefinido = modelosPredefinidos.some((m) => m.value === provider.modelo);

  const [selectValue, setSelectValue] = useState(
    isModeloPredefinido ? provider.modelo : modelosPredefinidos.length > 0 ? MODELO_PERSONALIZADO : provider.modelo,
  );
  const [modelo, setModelo] = useState(provider.modelo);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const predefinido = modelosPredefinidos.some((m) => m.value === provider.modelo);
    setSelectValue(predefinido ? provider.modelo : modelosPredefinidos.length > 0 ? MODELO_PERSONALIZADO : provider.modelo);
    setModelo(provider.modelo);
  }, [provider.modelo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className={`p-6 ${provider.ativo ? "border-accent/30 shadow-soft" : ""}`}>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <p className="font-heading text-xl font-extrabold text-ink">{provider.nome}</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={provider.ativo ? "green" : "slate"}>{provider.ativo ? "Ativa" : "Inativa"}</Badge>
            <Badge variant={provider.configurada ? "blue" : "amber"}>
              {provider.configurada ? "Chave configurada" : "Chave pendente"}
            </Badge>
            <ChevronIcon isOpen={isOpen} />
          </div>
        </button>

        {isOpen ? (
          <div className="space-y-5 border-t border-line/70 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm leading-6 text-slate">{provider.descricao}</p>
              </div>

              <div className="flex items-center gap-3">
                {saveIndicator === "saving" ? <span className="text-xs font-semibold text-amber-700">Salvando...</span> : null}
                {saveIndicator === "saved" ? <span className="text-xs font-semibold text-emerald-700">Salvo</span> : null}
                {!provider.ativo ? (
                  <Button variant="outline" isLoading={isActivating} onClick={() => onActivate(provider.id)}>
                    Ativar esta IA
                  </Button>
                ) : (
                  <Badge variant="green">IA em uso na extracao</Badge>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Modelo</span>
                {modelosPredefinidos.length > 0 ? (
                  <>
                    <select
                      value={selectValue}
                      onChange={(event) => {
                        const val = event.target.value;
                        setSelectValue(val);
                        if (val !== MODELO_PERSONALIZADO) setModelo(val);
                        else setModelo("");
                      }}
                      className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                    >
                      {modelosPredefinidos.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                      <option value={MODELO_PERSONALIZADO}>Personalizado...</option>
                    </select>
                    {selectValue === MODELO_PERSONALIZADO ? (
                      <input
                        value={modelo}
                        onChange={(event) => setModelo(event.target.value)}
                        placeholder="Digite o identificador do modelo"
                        className="mt-2 h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                      />
                    ) : null}
                  </>
                ) : (
                  <input
                    value={modelo}
                    onChange={(event) => setModelo(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-line bg-panel px-4 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                  />
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">API Key</span>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={provider.api_key_masked || "Nao configurada"}
                    className="h-12 w-full rounded-2xl border border-line bg-panel px-4 pr-12 text-sm text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate transition hover:text-ink"
                    aria-label={showKey ? "Ocultar" : "Mostrar"}
                  >
                    {showKey ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate/70">Deixe em branco para manter a chave atual.</p>
              </label>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  const update: { modelo?: string; api_key?: string } = {};
                  if (modelo.trim()) update.modelo = modelo.trim();
                  if (apiKey) update.api_key = apiKey;
                  await onSave(provider.id, update);
                  setApiKey("");
                }}
                isLoading={saveIndicator === "saving"}
              >
                Salvar configuracoes desta IA
              </Button>
            </div>

            <div className="rounded-[24px] border border-line bg-panel/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-heading text-lg font-extrabold text-ink">Treinamento desta IA</h4>
                  <p className="mt-1 text-sm text-slate">
                    Este prompt sera usado apenas quando {provider.nome} estiver ativa.
                  </p>
                </div>
                {promptSaveIndicator === "saving" ? (
                  <span className="text-xs font-semibold text-amber-700">Salvando...</span>
                ) : promptSaveIndicator === "saved" ? (
                  <span className="text-xs font-semibold text-emerald-700">Salvo</span>
                ) : null}
              </div>

              <textarea
                value={provider.prompt_extracao}
                onChange={(event) => onPromptChange(provider.id, event.target.value)}
                rows={12}
                className="mt-4 w-full rounded-2xl border border-line bg-white px-4 py-4 text-sm leading-7 text-ink outline-none transition focus:border-accent/40 focus:ring-4 focus:ring-accent/10"
              />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function TabIA() {
  const {
    config,
    status,
    errorMessage,
    saveIndicators,
    promptSaveIndicators,
    activatingProviderId,
    salvarIA,
    ativarIA,
    atualizarPrompt,
  } = useConfiguracaoIA();

  if (status === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-4 p-8">
          <Spinner size="lg" className="text-accent" />
          <p className="text-sm text-slate">Carregando configuracoes...</p>
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="border-rose-100 bg-rose-50/70">
        <div className="p-6">
          <p className="text-sm font-semibold text-rose-800">Backend indisponivel</p>
          <p className="mt-1 text-sm text-rose-700">{errorMessage}</p>
        </div>
      </Card>
    );
  }

  if (!config) return null;

  const activeProvider = config.providers.find((provider) => provider.ativo);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-extrabold text-ink">Inteligencia Artificial</h2>
          {activeProvider ? <Badge variant="green">Ativa: {activeProvider.nome}</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-slate">
          Configure varias IAs, mas mantenha apenas uma ativa por vez. O treinamento fica dentro de cada card.
        </p>
      </div>

      <div className="space-y-5">
        {config.providers.map((provider) => (
          <IAProviderCard
            key={provider.id}
            provider={provider}
            saveIndicator={saveIndicators[provider.id] ?? "idle"}
            promptSaveIndicator={promptSaveIndicators[provider.id] ?? "idle"}
            isActivating={activatingProviderId === provider.id}
            onSave={salvarIA}
            onActivate={ativarIA}
            onPromptChange={atualizarPrompt}
          />
        ))}
      </div>
    </div>
  );
}

function Configuracoes() {
  const [activeTab, setActiveTab] = useState("portais");

  return (
    <div className="h-full">
      <div className="border-b border-line px-6 pb-5 pt-7 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent/80">Sistema</p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold text-ink">Configuracoes</h1>
      </div>

      <div className="space-y-6 px-6 py-8 sm:px-8">
        <Tabs items={configTabs} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "portais" ? <TabPortais /> : <TabIA />}
      </div>
    </div>
  );
}

export { Configuracoes };
