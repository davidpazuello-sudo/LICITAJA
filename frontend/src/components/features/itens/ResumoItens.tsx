import { Badge } from "../../ui/Badge";
import { Card } from "../../ui/Card";

interface ResumoItensProps {
  total: number;
  pesquisados: number;
  aguardando: number;
}

function ResumoItens({ total, pesquisados, aguardando }: ResumoItensProps) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="blue">{total} {total === 1 ? "item" : "itens"}</Badge>
        <Badge variant="green">{pesquisados} {pesquisados === 1 ? "pesquisado" : "pesquisados"}</Badge>
        <Badge variant="amber">{aguardando} {aguardando === 1 ? "aguardando" : "aguardando"}</Badge>
      </div>
    </Card>
  );
}

export { ResumoItens };

