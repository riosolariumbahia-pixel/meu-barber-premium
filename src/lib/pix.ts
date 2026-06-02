// Gerador de BR Code (PIX EMV) estático no client.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string) {
  return id + value.length.toString().padStart(2, "0") + value;
}

export function buildPixPayload(opts: {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
}) {
  const name = opts.merchantName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25);
  const city = opts.merchantCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15);
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", opts.key);
  const fields: string[] = [];
  fields.push(tlv("00", "01"));
  fields.push(tlv("26", mai));
  fields.push(tlv("52", "0000"));
  fields.push(tlv("53", "986"));
  if (opts.amount && opts.amount > 0) fields.push(tlv("54", opts.amount.toFixed(2)));
  fields.push(tlv("58", "BR"));
  fields.push(tlv("59", name || "BARBEARIA"));
  fields.push(tlv("60", city || "BRASIL"));
  fields.push(tlv("62", tlv("05", (opts.txid || "***").slice(0, 25))));
  const partial = fields.join("") + "6304";
  return partial + crc16(partial);
}