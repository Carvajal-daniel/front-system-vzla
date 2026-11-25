"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Gift,
  Heart,
  Loader2,
  Package,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import { countryDefaults, type CompanyCountry } from "@/lib/company-settings";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useCompanySettings } from "@/lib/use-company-settings";
import { useSession } from "@/components/ui/auth-guard";
import type { Appointment } from "@/lib/types/appointment";
import type { AppointmentCollections, PaymentMethod, SavedFinanceOrder } from "@/lib/types/finance";
import type { InventoryItem } from "@/lib/types/inventory";
import type { Service } from "@/lib/types/service";
import type { Collaborator } from "@/lib/types/team";
import { useClients } from "@/lib/use-clients";
import { useLoyalty } from "@/lib/use-loyalty";

/**
 * Normaliza respostas da API para sempre retornar um array válido,
 * mesmo quando o backend envelopa a lista em chaves como services, items, collaborators ou appointments.
 */
function normalizeApiArray<T>(res: unknown, keys: string[]): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const record = res as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }
  return [];
}

/**
 * Extrai um objeto de agendamento de respostas diretas ou envelopadas.
 */
function normalizeAppointment(res: unknown): Partial<Appointment> | null {
  if (!res || typeof res !== "object") return null;
  const record = res as Record<string, unknown>;
  const candidate =
    record.appointment && typeof record.appointment === "object"
      ? (record.appointment as Partial<Appointment>)
      : (record as Partial<Appointment>);
  return candidate.id ? candidate : null;
}

/**
 * Aplica máscara estrita de CPF brasileiro (000.000.000-00).
 */
function formatBrazilianCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Normaliza formato venezuelano de C.I. / RIF (ex.: V-12.345.678 ou J-12345678-9).
 */
function formatVenezuelanDocument(value: string): string {
  const clean = value.toUpperCase().replace(/[^VEJG0-9-]/g, "");
  if (!clean) return "";
  const first = clean[0];
  const hasPrefix = first === "V" || first === "E" || first === "J" || first === "G";
  const prefix = hasPrefix ? first : "V";
  const digits = (hasPrefix ? clean.slice(1) : clean).replace(/\D/g, "").slice(0, 10);
  if (!digits) return hasPrefix ? `${prefix}-` : "";
  if (prefix === "J" || prefix === "G") {
    if (digits.length <= 8) return `${prefix}-${digits}`;
    return `${prefix}-${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
  }
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${prefix}-${formatted}`;
}

interface OrderLineItem {
  id: string;
  type: "SERVICE" | "PRODUCT" | "TIP";
  itemId: string;
  name: string;
  // String vazia representa "Venda da Empresa (Sem comissão)" para produtos
  collaboratorId: string;
  quantity: number;
  unitPriceCents: number;
  commissionPercentage: number;
  subtotalCents: number;
}

interface OrderPaymentEntry {
  id: string;
  method: PaymentMethod;
  amountCents: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const editingOrderId = searchParams.get("orderId");

  const { session } = useSession();
  const { locale } = useLocale();
  const isEs = locale === "es";
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  // Regionalização estrita baseada no countryCode configurado na empresa (BR ou VE)
  const { settings } = useCompanySettings(companyId);
  const countryCode: CompanyCountry =
    settings.countryCode === "VE" ||
    (!settings.countryCodeConfigured &&
      (session.company.timezone === "America/Caracas" || currency === "VES"))
      ? "VE"
      : "BR";
  const fixedDdi = countryDefaults[countryCode].ddi;
  const currencySymbol = currency === "USD" ? "$" : currency === "VES" ? "Bs." : "R$";

  const copy = useMemo(
    () =>
      isEs
        ? {
            backToOrders: "Volver a Comandas",
            title: "Nueva Comanda Completa",
            subtitle:
              "Registro completo de servicios, productos de inventario, comisiones por profesional y cobro.",
            codeLabel: "Código:",
            sectionOrderClient: "Información de la Comanda y Cliente",
            modeClient: "Comanda de Cliente",
            modeWalkIn: "Venta Suelta / Producto de la Empresa",
            walkInHint:
              "No es necesario identificar un cliente para ventas sueltas de productos o mostrador.",
            orderDate: "Fecha de la Comanda",
            orderStatus: "Estado de la Comanda",
            statusOpen: "Abierta (Esperando pago total)",
            statusClosed: "Cerrada (Pagada o Facturada)",
            statusHint: "* Marcar \"Cerrada\" libera la comisión de los profesionales en el período.",
            clientLabelOptional: "Cliente (opcional)",
            clientPlaceholder: "Buscar cliente en la base o escribir nombre...",
            debtLabel: "Deuda:",
            phoneLabel: "Teléfono / WhatsApp",
            addressHide: "Ocultar dirección",
            addressShow: "+ Agregar datos de dirección / entrega",
            streetPlaceholder: "Calle / Avenida",
            numberPlaceholder: "Nº",
            notesLabel: "Observaciones de la Comanda",
            notesPlaceholder: "Preferencias, instrucciones o notas de la venta...",
            paymentSummary: "Resumen de Pago",
            subtotal: "Subtotal:",
            discount: "Descuento:",
            totalOrder: "Total de la Comanda:",
            paidAmount: "Valor Pagado:",
            remainingAmount: "Resta por Pagar:",
            commissionsTotal: "Comisiones de Profesionales:",
            commissionsHint: "La comisión se libera tras la liquidación total de la comanda.",
            addPaymentLabel: "Registrar Medio de Pago",
            addPaymentBtn: "+ Pagar",
            loyaltyTitle: "Programa de Fidelidad",
            loyaltyPoints: "Puntos acumulados:",
            loyaltyEmpty: "Selecciona un cliente para ver su saldo de puntos.",
            itemsTitle: "Ítems de la Comanda (Servicios e Inventario)",
            itemsSubtitle:
              "Agrega servicios, productos vendidos (con baja automática de stock) y propinas.",
            addService: "+ Servicio",
            addProduct: "+ Producto (Stock)",
            addTip: "+ Propina",
            noItems:
              "Ningún servicio o producto agregado. Haz clic en los botones de arriba para incluir ítems.",
            colType: "Tipo",
            colItem: "Ítem / Procedimiento",
            colProfessional: "Profesional / Responsable",
            colQty: "Cant.",
            colUnitPrice: "Valor Unitario",
            colCommission: "% Comisión",
            colSubtotal: "Subtotal",
            typeService: "Servicio",
            typeProduct: "Producto",
            typeTip: "Propina",
            companySaleOption: "Venta de la Empresa (Sin comisión)",
            noProfessionalOption: "Sin profesional",
            inStockSuffix: "en stock",
            netTotalLabel: "Total Neto de la Comanda:",
            cancelBtn: "Cancelar",
            saveBtn: "Guardar Comanda / Finalizar Venta",
            errorNoItems: "Agrega al menos un servicio o producto en la comanda.",
            errorInsufficientStock: "Stock insuficiente para uno o más productos seleccionados.",
            errorSaveGeneric: "No fue posible guardar la comanda. Revisa los datos e intenta nuevamente.",
            successSaved: (code: string) =>
              `¡Comanda ${code} guardada con éxito! Stock y pagos actualizados.`,
            methods: {
              PIX: "PIX",
              CASH: "Efectivo",
              CREDIT_CARD: "Tarjeta de Crédito",
              DEBIT_CARD: "Tarjeta de Débito",
              TRANSFER: "Transferencia",
              OTHER: "Otros",
            } as Record<PaymentMethod, string>,
          }
        : {
            backToOrders: "Voltar para Comandas",
            title: "Nova Comanda Completa",
            subtitle:
              "Lançamento completo de serviços, produtos de estoque, comissões por profissional e quitação.",
            codeLabel: "Código:",
            sectionOrderClient: "Informações da Comanda & Cliente",
            modeClient: "Comanda de Cliente",
            modeWalkIn: "Venda Avulsa / Produto da Empresa",
            walkInHint:
              "Não é obrigatório informar cliente para venda avulsa de produtos ou balcão.",
            orderDate: "Data da Comanda",
            orderStatus: "Status da Comanda",
            statusOpen: "Aberta (Aguardando quitação total)",
            statusClosed: "Fechada (Quitada ou Faturada)",
            statusHint: "* Marcar \"Fechada\" libera a comissão dos profissionais no período.",
            clientLabelOptional: "Cliente (opcional)",
            clientPlaceholder: "Buscar cliente na base ou digitar nome...",
            debtLabel: "Débito:",
            phoneLabel: "Telefone / WhatsApp",
            addressHide: "Ocultar endereço",
            addressShow: "+ Adicionar dados de endereço / entrega",
            streetPlaceholder: "Logradouro / Rua",
            numberPlaceholder: "Nº",
            notesLabel: "Observações da Comanda",
            notesPlaceholder: "Preferências, instruções especiais ou observações do atendimento...",
            paymentSummary: "Resumo de Pagamento",
            subtotal: "Subtotal:",
            discount: "Desconto:",
            totalOrder: "Total da Comanda:",
            paidAmount: "Valor Pago:",
            remainingAmount: "Resta a Pagar:",
            commissionsTotal: "Comissões dos Profissionais:",
            commissionsHint: "A comissão é liberada após a quitação total da comanda.",
            addPaymentLabel: "Lançar Meio de Pagamento",
            addPaymentBtn: "+ Pagar",
            loyaltyTitle: "Programa de Fidelidade",
            loyaltyPoints: "Pontos acumulados:",
            loyaltyEmpty:
              "Selecione um cliente para visualizar o saldo de pontos na cartela de fidelidade.",
            itemsTitle: "Itens da Comanda (Serviços e Estoque)",
            itemsSubtitle:
              "Adicione procedimentos, produtos vendidos (com baixa automática no estoque) e gorjetas.",
            addService: "+ Serviço",
            addProduct: "+ Produto (Estoque)",
            addTip: "+ Gorjeta",
            noItems:
              "Nenhum serviço ou produto adicionado. Clique nos botões acima para incluir itens na comanda.",
            colType: "Tipo",
            colItem: "Item / Procedimento",
            colProfessional: "Profissional / Responsável",
            colQty: "Qtd",
            colUnitPrice: "Valor Unitário",
            colCommission: "% Comissão",
            colSubtotal: "Subtotal",
            typeService: "Serviço",
            typeProduct: "Produto",
            typeTip: "Gorjeta",
            companySaleOption: "Venda da Empresa (Sem comissão)",
            noProfessionalOption: "Sem profissional",
            inStockSuffix: "em estoque",
            netTotalLabel: "Total Líquido da Comanda:",
            cancelBtn: "Cancelar",
            saveBtn: "Salvar Comanda / Finalizar Venda",
            errorNoItems: "Adicione ao menos um serviço ou produto na comanda.",
            errorInsufficientStock: "Estoque insuficiente para um ou mais produtos selecionados.",
            errorSaveGeneric: "Não foi possível salvar a comanda. Verifique os dados e tente novamente.",
            successSaved: (code: string) =>
              `Comanda ${code} salva com sucesso! Estoque e recebimentos atualizados.`,
            methods: {
              PIX: "PIX",
              CASH: "Dinheiro",
              CREDIT_CARD: "Cartão de Crédito",
              DEBIT_CARD: "Cartão de Débito",
              TRANSFER: "Transferência",
              OTHER: "Outros",
            } as Record<PaymentMethod, string>,
          },
    [isEs],
  );

  const { clients, createClient } = useClients(companyId);
  const { program, getClientLoyalty, addPoints } = useLoyalty(companyId);

  // Dados do Catálogo
  const [services, setServices] = useState<Service[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [, setLoadingCatalog] = useState(true);

  // Modo da comanda: vinculada a cliente ou venda avulsa / produto da empresa
  const [saleMode, setSaleMode] = useState<"CLIENT" | "WALK_IN">("CLIENT");

  // Informações da Comanda (Coluna Esquerda)
  const [orderCode, setOrderCode] = useState(() => `COM-${Date.now().toString().slice(-6)}`);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderStatus, setOrderStatus] = useState<"OPEN" | "CLOSED">("CLOSED");

  // Itens da Comanda (Bloco Inferior)
  const [items, setItems] = useState<OrderLineItem[]>([]);

  // Pagamento & Desconto (Coluna Direita)
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [payments, setPayments] = useState<OrderPaymentEntry[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(
    countryCode === "BR" ? "PIX" : "CASH",
  );
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestKeyRef = useRef<string>(crypto.randomUUID());

  // Limpa qualquer rascunho residual em storage e reinicia o formulário 100% zerado
  const resetOrderForm = () => {
    try {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (/order_draft|comanda_draft|new_order/i.test(key)) {
            storage.removeItem(key);
          }
        }
      }
    } catch {
      // Storage indisponível
    }
    setSaleMode("CLIENT");
    setOrderCode(`COM-${Date.now().toString().slice(-6)}`);
    setOrderDate(new Date().toISOString().split("T")[0]);
    setClientSearch("");
    setSelectedClientId("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientDocument("");
    setShowAddress(false);
    setAddressStreet("");
    setAddressNumber("");
    setOrderNotes("");
    setOrderStatus("CLOSED");
    setItems([]);
    setDiscountType("FIXED");
    setDiscountValue("");
    setPayments([]);
    setSelectedPaymentMethod(countryCode === "BR" ? "PIX" : "CASH");
    setPaymentAmountInput("");
    requestKeyRef.current = crypto.randomUUID();
  };

  // Carrega Catálogo e Pré-preenche se vier de um agendamento
  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);

    const applyAppointmentToOrder = (
      app: Partial<Appointment>,
      fallbackServices: Service[],
      fallbackCollabs: Collaborator[],
    ) => {
      const safeName = typeof app.clientName === "string" ? app.clientName : "";
      const safePhone = typeof app.clientPhone === "string" ? app.clientPhone : "";
      setSaleMode("CLIENT");
      setClientName(safeName);
      setClientPhone(safePhone.replace(/^\+?(55|58)/, "").trim());
      setClientSearch(safeName);

      const matchedService = fallbackServices.find((s) => s.id === app.serviceId);
      const serviceId = app.serviceId || matchedService?.id || "";
      const serviceName = app.serviceNameSnapshot || matchedService?.name || "Serviço";
      const unitPriceCents =
        typeof app.servicePriceInCentsSnapshot === "number"
          ? app.servicePriceInCentsSnapshot
          : (matchedService?.priceInCents ?? 0);
      const collaboratorId = app.collaboratorId || fallbackCollabs[0]?.id || "";
      const commissionPercentage =
        typeof app.commissionPercentageSnapshot === "number" && app.commissionPercentageSnapshot > 0
          ? app.commissionPercentageSnapshot
          : 50;

      setItems([
        {
          id: `line_${Date.now()}`,
          type: "SERVICE",
          itemId: serviceId,
          name: serviceName,
          collaboratorId,
          quantity: 1,
          unitPriceCents,
          commissionPercentage,
          subtotalCents: unitPriceCents,
        },
      ]);
    };

    Promise.all([
      apiRequest<unknown>("/services").catch(() => []),
      apiRequest<unknown>("/collaborators").catch(() => []),
      apiRequest<unknown>("/inventory/items").catch(() => []),
    ])
      .then(async ([svcRes, colRes, invRes]) => {
        if (!active) return;

        const servicesList = normalizeApiArray<Service>(svcRes, ["services", "items"]);
        const collabsList = normalizeApiArray<Collaborator>(colRes, ["collaborators", "items"]);
        const invList = normalizeApiArray<InventoryItem>(invRes, [
          "items",
          "inventoryItems",
          "products",
        ]);

        setServices(servicesList);
        setCollaborators(collabsList);
        setInventoryItems(invList);

        // Quando abrir "+ Nova Comanda" sem vínculo, garante formulário 100% zerado
        if (!appointmentId && !editingOrderId) {
          resetOrderForm();
          return;
        }

        // Modo edição controlada de comanda aberta (inclusive reaberta via PIN do Dono)
        if (editingOrderId) {
          const existingOrder = await apiRequest<SavedFinanceOrder>(
            `/finance/orders/${encodeURIComponent(editingOrderId)}`,
          ).catch(() => null);

          if (!active) return;

          if (!existingOrder) {
            toast.error(isEs ? "Comanda no encontrada." : "Comanda não encontrada.");
            router.replace("/owner/finance");
            return;
          }

          if (existingOrder.status === "CLOSED") {
            toast.error(
              isEs
                ? "Esta comanda está cerrada. Reábrela con el PIN del Dueño antes de editar."
                : "Esta comanda está fechada. Reabra com o PIN do Dono antes de editar.",
            );
            router.replace("/owner/finance");
            return;
          }

          setOrderCode(existingOrder.code);
          setOrderDate(existingOrder.orderDate);
          setOrderStatus(existingOrder.status);
          const hasClient = Boolean(existingOrder.clientName?.trim());
          setSaleMode(hasClient ? "CLIENT" : "WALK_IN");
          setClientName(existingOrder.clientName ?? "");
          setClientSearch(existingOrder.clientName ?? "");
          setClientPhone((existingOrder.clientPhone ?? "").replace(/^\+?(55|58)/, "").trim());
          setClientDocument(existingOrder.clientDocument ?? "");
          setOrderNotes(existingOrder.notes ?? "");
          setDiscountType("FIXED");
          setDiscountValue(
            existingOrder.discountCents > 0 ? (existingOrder.discountCents / 100).toFixed(2) : "",
          );
          setItems(
            existingOrder.items.map((it) => ({
              id: it.id,
              type: it.itemType,
              itemId: it.referenceId ?? "",
              name: it.name,
              collaboratorId: it.collaboratorId ?? "",
              quantity: it.quantity,
              unitPriceCents: it.unitPriceCents,
              commissionPercentage: it.commissionPercentage ?? 0,
              subtotalCents: it.subtotalCents,
            })),
          );
          setPayments(
            existingOrder.payments.map((p) => ({
              id: p.id,
              method: p.method,
              amountCents: p.amountCents,
            })),
          );
          return;
        }

        if (appointmentId) {
          const singleRes = await apiRequest<unknown>(
            `/appointments/${encodeURIComponent(appointmentId)}`,
          ).catch(() => null);
          const singleApp = normalizeAppointment(singleRes);

          if (!active) return;

          if (singleApp) {
            applyAppointmentToOrder(singleApp, servicesList, collabsList);
            return;
          }

          const listRes = await apiRequest<unknown>("/appointments").catch(() => []);
          const appointmentsList = normalizeApiArray<Appointment>(listRes, [
            "appointments",
            "items",
          ]);
          const foundInList = appointmentsList.find((a) => a.id === appointmentId);

          if (!active) return;

          if (foundInList) {
            applyAppointmentToOrder(foundInList, servicesList, collabsList);
            return;
          }

          const financeApp = await apiRequest<AppointmentCollections>(
            `/finance/appointments/${encodeURIComponent(appointmentId)}`,
          ).catch(() => null);

          if (!active || !financeApp) return;

          const matchedByName = servicesList.find((s) => s.name === financeApp.serviceName);
          applyAppointmentToOrder(
            {
              id: financeApp.appointmentId,
              clientName: financeApp.clientName ?? "",
              clientPhone: "",
              serviceId: matchedByName?.id ?? "",
              serviceNameSnapshot: financeApp.serviceName ?? "Serviço",
              servicePriceInCentsSnapshot: financeApp.netInCents ?? 0,
              collaboratorId: collabsList[0]?.id ?? "",
              commissionPercentageSnapshot: 50,
            },
            servicesList,
            collabsList,
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId, editingOrderId]);

  const safeServices = Array.isArray(services) ? services : [];
  const safeCollaborators = Array.isArray(collaborators) ? collaborators : [];
  const safeInventoryItems = Array.isArray(inventoryItems) ? inventoryItems : [];

  // Autocomplete de Clientes
  const matchingClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const q = clientSearch.trim().toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q),
    );
  }, [clients, clientSearch]);

  const selectClient = (c: (typeof clients)[0]) => {
    setSelectedClientId(c.id);
    setClientName(c.name);
    setClientPhone(c.phone.replace(/^\+?(55|58)/, "").trim());
    setClientEmail(c.email || "");
    setClientDocument(c.document || "");
    setClientSearch(c.name);
  };

  // Cálculo de Valores
  const subtotalCents = useMemo(
    () => items.reduce((sum, item) => sum + item.subtotalCents, 0),
    [items],
  );

  const discountCents = useMemo(() => {
    const raw = parseFloat(discountValue.replace(",", ".")) || 0;
    if (discountType === "PERCENT") {
      return Math.round((subtotalCents * Math.min(100, Math.max(0, raw))) / 100);
    }
    return Math.min(subtotalCents, Math.max(0, Math.round(raw * 100)));
  }, [subtotalCents, discountType, discountValue]);

  const totalCents = Math.max(0, subtotalCents - discountCents);

  const totalPaidCents = useMemo(
    () => payments.reduce((sum, p) => sum + p.amountCents, 0),
    [payments],
  );

  const remainingCents = Math.max(0, totalCents - totalPaidCents);

  // Soma das comissões previstas para os profissionais atribuídos nos itens da comanda
  const totalCommissionCents = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!item.collaboratorId) return sum;
        const pct = Math.max(0, Math.min(100, Math.round(item.commissionPercentage || 0)));
        return sum + Math.round((item.subtotalCents * pct) / 100);
      }, 0),
    [items],
  );

  // Adicionar Linhas
  const handleAddServiceLine = () => {
    const defaultSvc = safeServices[0];
    const defaultCollab = safeCollaborators[0];
    if (!defaultSvc) return;

    setItems((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "SERVICE",
        itemId: defaultSvc.id,
        name: defaultSvc.name,
        collaboratorId: defaultCollab?.id || "",
        quantity: 1,
        unitPriceCents: defaultSvc.priceInCents,
        commissionPercentage: 50,
        subtotalCents: defaultSvc.priceInCents,
      },
    ]);
  };

  const handleAddProductLine = () => {
    const defaultProd = safeInventoryItems[0];
    if (!defaultProd) return;
    const price = defaultProd.salePriceCents || defaultProd.costPriceCents;

    setItems((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "PRODUCT",
        itemId: defaultProd.id,
        name: defaultProd.name,
        // Padrão: Venda da Empresa (Sem comissão) quando em modo avulso, ou primeiro profissional
        collaboratorId: saleMode === "WALK_IN" ? "" : (safeCollaborators[0]?.id || ""),
        quantity: 1,
        unitPriceCents: price,
        commissionPercentage: saleMode === "WALK_IN" ? 0 : 10,
        subtotalCents: price,
      },
    ]);
  };

  const handleAddTipLine = () => {
    const defaultCollab = safeCollaborators[0];
    setItems((prev) => [
      ...prev,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "TIP",
        itemId: "",
        name: isEs ? "Propina para Profesional" : "Gorjeta para Profissional",
        collaboratorId: defaultCollab?.id || "",
        quantity: 1,
        unitPriceCents: 1000,
        commissionPercentage: 100,
        subtotalCents: 1000,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Adicionar Pagamento
  const handleAddPayment = () => {
    const parsed = Math.round(parseFloat(paymentAmountInput.replace(",", ".")) * 100) || 0;
    const amount = parsed > 0 ? parsed : remainingCents;
    if (amount <= 0) return;

    setPayments((prev) => [
      ...prev,
      {
        id: `pay_${Date.now()}`,
        method: selectedPaymentMethod,
        amountCents: amount,
      },
    ]);
    setPaymentAmountInput("");
  };

  const handleRemovePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  // Salvar Comanda Completa via endpoint atômico POST /finance/orders
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error(copy.errorNoItems);
      return;
    }

    const trimmedName = saleMode === "CLIENT" ? clientName.trim() : "";
    const normalizedPhone =
      saleMode === "CLIENT" && clientPhone.trim()
        ? `${fixedDdi} ${clientPhone.trim()}`
        : null;

    setSubmitting(true);
    try {
      // 1. Se houver cliente informado com telefone e ainda não estiver na base, cadastra automaticamente
      let targetClientId = selectedClientId;
      if (trimmedName && normalizedPhone && !targetClientId) {
        try {
          targetClientId = await createClient({
            name: trimmedName,
            phone: normalizedPhone,
            email: clientEmail || undefined,
            document: clientDocument || undefined,
          });
        } catch {
          // Não bloqueia o fechamento da comanda caso o telefone já exista ou seja inválido
        }
      }

      // 2. Persiste comanda, pagamentos e baixa automática de estoque (SALE_OUT) em transação única no backend
      const addressNote =
        showAddress && (addressStreet.trim() || addressNumber.trim())
          ? `Endereço: ${addressStreet.trim()} ${addressNumber.trim()}`.trim()
          : "";
      const combinedNotes = [orderNotes.trim(), addressNote].filter(Boolean).join(" | ") || null;

      const payloadBase = {
        clientName: trimmedName || null,
        clientPhone: normalizedPhone,
        clientDocument: saleMode === "CLIENT" && clientDocument.trim() ? clientDocument.trim() : null,
        orderDate,
        status: orderStatus,
        discountCents,
        notes: combinedNotes,
        items: items.map((item) => ({
          itemType: item.type,
          referenceId: item.itemId || null,
          name: item.name,
          collaboratorId: item.collaboratorId || null,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          commissionPercentage: item.collaboratorId ? item.commissionPercentage : 0,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amountCents: p.amountCents,
        })),
      };

      if (editingOrderId) {
        await apiRequest(`/finance/orders/${encodeURIComponent(editingOrderId)}`, {
          method: "PATCH",
          body: payloadBase,
        });
      } else {
        await apiRequest("/finance/orders", {
          method: "POST",
          body: {
            ...payloadBase,
            code: orderCode,
            appointmentId: appointmentId || null,
            requestKey: requestKeyRef.current,
          },
        });
      }

      // 3. Se o programa de fidelidade estiver ativo e houver cliente vinculado, pontua o cliente
      if (!editingOrderId && program.autoPointOnCompletion && targetClientId) {
        addPoints(targetClientId, 1, `Pontuação da comanda ${orderCode}`);
      }

      const savedCode = orderCode;
      // Limpa qualquer estado residual ou rascunho assim que a comanda é finalizada
      resetOrderForm();
      toast.success(copy.successSaved(savedCode));
      router.push("/owner/finance");
      router.refresh();
    } catch (err) {
      // Gera nova requestKey para nova tentativa caso a validação/estoque tenha falhado
      requestKeyRef.current = crypto.randomUUID();
      if (err instanceof ApiError && err.message.includes("INVENTORY_INSUFFICIENT_STOCK")) {
        toast.error(copy.errorInsufficientStock);
      } else if (err instanceof ApiError && err.message) {
        toast.error(err.message);
      } else {
        toast.error(copy.errorSaveGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const clientLoyalty = selectedClientId ? getClientLoyalty(selectedClientId) : null;

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/finance"
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          {copy.backToOrders}
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Receipt className="size-6 text-accent" />
            {copy.title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{copy.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm font-bold text-accent">
          {copy.codeLabel} {orderCode}
        </div>
      </div>

      <form onSubmit={handleSubmitOrder} autoComplete="off" className="space-y-6">
        {/* ======================================================== */}
        {/* PARTE SUPERIOR: 2 COLUNAS (INFORMAÇÕES + PAGAMENTO) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda: Informações da Comanda (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <User size={16} className="text-accent" />
                {copy.sectionOrderClient}
              </h3>

              {/* Seletor: Comanda com Cliente vs Venda Avulsa / Produto da Empresa */}
              <div className="inline-flex rounded-xl border border-border-subtle bg-canvas/50 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSaleMode("CLIENT")}
                  className={`flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${
                    saleMode === "CLIENT"
                      ? "bg-accent text-accent-ink shadow-2xs"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  <User size={12} />
                  {copy.modeClient}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaleMode("WALK_IN");
                    setSelectedClientId("");
                  }}
                  className={`flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 transition-colors ${
                    saleMode === "WALK_IN"
                      ? "bg-accent text-accent-ink shadow-2xs"
                      : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  <Building2 size={12} />
                  {copy.modeWalkIn}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  {copy.orderDate}
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  {copy.orderStatus}
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as "OPEN" | "CLOSED")}
                  className="w-full cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink font-semibold"
                >
                  <option value="OPEN">{copy.statusOpen}</option>
                  <option value="CLOSED">{copy.statusClosed}</option>
                </select>
                <p className="mt-1 text-[10px] text-ink-muted">{copy.statusHint}</p>
              </div>
            </div>

            {saleMode === "WALK_IN" ? (
              <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3 text-xs text-ink-secondary flex items-center gap-2">
                <Building2 size={16} className="text-accent shrink-0" />
                <span>{copy.walkInHint}</span>
              </div>
            ) : (
              <>
                {/* Busca e Autocomplete de Cliente (opcional) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">
                    {copy.clientLabelOptional}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={copy.clientPlaceholder}
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        setClientSearch(e.target.value);
                        setSelectedClientId("");
                      }}
                      className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                    />
                    <Search size={14} className="absolute right-3 top-2.5 text-ink-muted" />
                  </div>

                  {matchingClients.length > 0 && !selectedClientId && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-1 shadow-lg text-xs space-y-0.5">
                      {matchingClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectClient(c)}
                          className="w-full cursor-pointer text-left rounded-lg p-2 hover:bg-canvas/50 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-ink block">{c.name}</span>
                            <span className="text-[10px] text-ink-muted font-mono">
                              {c.phone}
                            </span>
                          </div>
                          {c.pendingDebtCents > 0 && (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                              {copy.debtLabel}{" "}
                              {formatPriceFromCents(c.pendingDebtCents, locale, currency)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Regionalização estrita: BR (CPF + +55) ou VE (C.I. / RIF + +58) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      {copy.phoneLabel}
                    </label>
                    <div className="flex gap-1.5">
                      <span
                        aria-label={`DDI ${fixedDdi}`}
                        className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-canvas/70 px-3 py-2 text-xs font-bold font-mono text-ink-secondary shrink-0 select-none"
                      >
                        {fixedDdi}
                      </span>
                      <input
                        type="tel"
                        placeholder={
                          countryCode === "BR" ? "(11) 99999-9999" : "(0412) 123-4567"
                        }
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1">
                      {countryCode === "BR" ? "CPF" : "C.I. / RIF"}
                    </label>
                    <input
                      type="text"
                      placeholder={countryCode === "BR" ? "000.000.000-00" : "V-12.345.678"}
                      value={clientDocument}
                      onChange={(e) =>
                        setClientDocument(
                          countryCode === "BR"
                            ? formatBrazilianCpf(e.target.value)
                            : formatVenezuelanDocument(e.target.value),
                        )
                      }
                      className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                    />
                  </div>
                </div>

                {/* Endereço Expansível */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAddress(!showAddress)}
                    className="cursor-pointer text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform ${showAddress ? "rotate-180" : ""}`}
                    />
                    {showAddress ? copy.addressHide : copy.addressShow}
                  </button>

                  {showAddress && (
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <input
                        type="text"
                        placeholder={copy.streetPlaceholder}
                        value={addressStreet}
                        onChange={(e) => setAddressStreet(e.target.value)}
                        className="col-span-2 rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                      />
                      <input
                        type="text"
                        placeholder={copy.numberPlaceholder}
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        className="rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                {copy.notesLabel}
              </label>
              <textarea
                rows={2}
                placeholder={copy.notesPlaceholder}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink resize-none"
              />
            </div>
          </div>

          {/* Coluna Direita: Pagamento & Fidelidade (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-border-subtle pb-2">
                <Wallet size={16} className="text-emerald-500" />
                {copy.paymentSummary}
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>{copy.subtotal}</span>
                  <span>{formatPriceFromCents(subtotalCents, locale, currency)}</span>
                </div>

                {/* Desconto */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">{copy.discount}</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")}
                      className="cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-1.5 py-1 text-[11px] text-ink"
                    >
                      <option value="FIXED">{currencySymbol}</option>
                      <option value="PERCENT">%</option>
                    </select>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-right text-ink"
                    />
                  </div>
                </div>

                <div className="flex justify-between font-bold text-ink text-sm border-t border-border-subtle/70 pt-2">
                  <span>{copy.totalOrder}</span>
                  <span className="text-accent">
                    {formatPriceFromCents(totalCents, locale, currency)}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>{copy.paidAmount}</span>
                  <span>{formatPriceFromCents(totalPaidCents, locale, currency)}</span>
                </div>

                <div className="flex justify-between font-bold text-rose-500">
                  <span>{copy.remainingAmount}</span>
                  <span>{formatPriceFromCents(remainingCents, locale, currency)}</span>
                </div>

                {/* Linha informativa de comissões dos profissionais */}
                <div className="border-t border-border-subtle/70 pt-2 space-y-0.5">
                  <div className="flex justify-between font-semibold text-ink-secondary">
                    <span>{copy.commissionsTotal}</span>
                    <span className="text-ink tabular-nums">
                      {formatPriceFromCents(totalCommissionCents, locale, currency)}
                    </span>
                  </div>
                  <p className="text-[10px] leading-snug text-ink-muted">{copy.commissionsHint}</p>
                </div>
              </div>

              {/* Lançamento de Pagamentos */}
              <div className="border-t border-border-subtle/70 pt-3 space-y-2">
                <span className="block text-xs font-semibold text-ink-secondary">
                  {copy.addPaymentLabel}
                </span>

                <div className="flex gap-2">
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod)}
                    className="flex-1 cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                  >
                    <option value="PIX">{copy.methods.PIX}</option>
                    <option value="CASH">{copy.methods.CASH}</option>
                    <option value="CREDIT_CARD">{copy.methods.CREDIT_CARD}</option>
                    <option value="DEBIT_CARD">{copy.methods.DEBIT_CARD}</option>
                    <option value="TRANSFER">{copy.methods.TRANSFER}</option>
                  </select>

                  <input
                    type="text"
                    placeholder={`${currencySymbol} ${(remainingCents / 100).toFixed(2)}`}
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    className="w-24 rounded-xl border border-border-subtle bg-canvas/40 px-2 py-1.5 text-xs text-ink text-right"
                  />

                  <button
                    type="button"
                    onClick={handleAddPayment}
                    className="cursor-pointer rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    {copy.addPaymentBtn}
                  </button>
                </div>

                {payments.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg bg-canvas/40 px-2.5 py-1 text-xs"
                      >
                        <span className="font-medium text-ink">
                          {copy.methods[p.method] ?? p.method}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatPriceFromCents(p.amountCents, locale, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePayment(p.id)}
                            className="cursor-pointer text-ink-muted hover:text-rose-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card de Programa de Fidelidade */}
            <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Gift size={15} className="text-amber-500" />
                  {copy.loyaltyTitle}
                </span>
                <span className="text-[11px] text-accent font-semibold">{program.name}</span>
              </div>

              {clientLoyalty ? (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-ink-muted">
                    <span>{copy.loyaltyPoints}</span>
                    <strong className="text-ink font-bold">
                      {clientLoyalty.points} / {program.pointsRequired} pts
                    </strong>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, (clientLoyalty.points / program.pointsRequired) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">{copy.loyaltyEmpty}</p>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PARTE INFERIOR: SERVIÇOS, PRODUTOS E GORJETAS */}
        {/* ======================================================== */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-base font-bold text-ink">{copy.itemsTitle}</h3>
              <p className="text-xs text-ink-muted">{copy.itemsSubtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddServiceLine}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Plus size={13} />
                {copy.addService}
              </button>

              <button
                type="button"
                onClick={handleAddProductLine}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Package size={13} />
                {copy.addProduct}
              </button>

              <button
                type="button"
                onClick={handleAddTipLine}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Heart size={13} className="text-rose-500" />
                {copy.addTip}
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-muted">{copy.noItems}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">{copy.colType}</th>
                    <th className="py-2.5 px-3">{copy.colItem}</th>
                    <th className="py-2.5 px-3">{copy.colProfessional}</th>
                    <th className="py-2.5 px-3">{copy.colQty}</th>
                    <th className="py-2.5 px-3">{copy.colUnitPrice}</th>
                    <th className="py-2.5 px-3">{copy.colCommission}</th>
                    <th className="py-2.5 px-3">{copy.colSubtotal}</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {items.map((item, idx) => {
                    const isCompanySale = item.type === "PRODUCT" && !item.collaboratorId;
                    return (
                      <tr key={item.id} className="hover:bg-canvas/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              item.type === "SERVICE"
                                ? "bg-accent/10 text-accent"
                                : item.type === "PRODUCT"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {item.type === "SERVICE"
                              ? copy.typeService
                              : item.type === "PRODUCT"
                                ? copy.typeProduct
                                : copy.typeTip}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 min-w-[180px]">
                          {item.type === "SERVICE" ? (
                            <select
                              value={item.itemId}
                              onChange={(e) => {
                                const found = safeServices.find((s) => s.id === e.target.value);
                                if (!found) return;
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          itemId: found.id,
                                          name: found.name,
                                          unitPriceCents: found.priceInCents,
                                          subtotalCents: found.priceInCents * it.quantity,
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                            >
                              {item.itemId &&
                                !safeServices.some((s) => s.id === item.itemId) && (
                                  <option value={item.itemId}>{item.name}</option>
                                )}
                              {!item.itemId && <option value="">{item.name}</option>}
                              {safeServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          ) : item.type === "PRODUCT" ? (
                            <select
                              value={item.itemId}
                              onChange={(e) => {
                                const found = safeInventoryItems.find(
                                  (p) => p.id === e.target.value,
                                );
                                if (!found) return;
                                const price = found.salePriceCents || found.costPriceCents;
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          itemId: found.id,
                                          name: found.name,
                                          unitPriceCents: price,
                                          subtotalCents: price * it.quantity,
                                        }
                                      : it,
                                  ),
                                );
                              }}
                              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                            >
                              {safeInventoryItems.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.currentStock} {copy.inStockSuffix})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-ink">{item.name}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[180px]">
                          <select
                            value={item.collaboratorId}
                            onChange={(e) => {
                              const nextCollabId = e.target.value;
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        collaboratorId: nextCollabId,
                                        commissionPercentage:
                                          nextCollabId === ""
                                            ? 0
                                            : it.commissionPercentage === 0 &&
                                                it.type === "PRODUCT"
                                              ? 10
                                              : it.commissionPercentage,
                                      }
                                    : it,
                                ),
                              );
                            }}
                            className="w-full cursor-pointer rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                          >
                            {item.type === "PRODUCT" ? (
                              <option value="">{copy.companySaleOption}</option>
                            ) : (
                              !item.collaboratorId && (
                                <option value="">{copy.noProfessionalOption}</option>
                              )
                            )}
                            {safeCollaborators.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2.5 px-3 w-16">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const q = Math.max(1, Number(e.target.value) || 1);
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        quantity: q,
                                        subtotalCents: it.unitPriceCents * q,
                                      }
                                    : it,
                                ),
                              );
                            }}
                            className="w-14 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink text-center"
                          />
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-ink">
                          {formatPriceFromCents(item.unitPriceCents, locale, currency)}
                        </td>

                        <td className="py-2.5 px-3 w-20">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            disabled={isCompanySale}
                            value={isCompanySale ? 0 : item.commissionPercentage}
                            onChange={(e) => {
                              const comm = Math.max(
                                0,
                                Math.min(100, Number(e.target.value) || 0),
                              );
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, commissionPercentage: comm } : it,
                                ),
                              );
                            }}
                            className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink text-center disabled:opacity-50"
                          />
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-ink">
                          {formatPriceFromCents(item.subtotalCents, locale, currency)}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(item.id)}
                            className="cursor-pointer text-ink-muted hover:text-rose-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé de Ação */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border-subtle pt-4">
            <div className="text-sm font-bold text-ink">
              {copy.netTotalLabel}{" "}
              <span className="text-accent text-base">
                {formatPriceFromCents(totalCents, locale, currency)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/owner/finance"
                className="cursor-pointer rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
              >
                {copy.cancelBtn}
              </Link>

              <button
                type="submit"
                disabled={submitting}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {copy.saveBtn}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
