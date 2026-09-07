using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace Kairo.Diagnostics {
    public sealed class MwlQueryRequest {
        public string host, callingAe, calledAe, scheduledDate;
        public int port, timeoutMs;
    }
    public sealed class MwlLayerResult {
        public string state = "NOT_RUN", code = "NOT_RUN", detail = "Not attempted.", dicomStatus = "";
        public long elapsedMs;
        public void Set(string stateValue, string codeValue, string detailValue, long elapsed) { state = stateValue; code = codeValue; detail = detailValue; elapsedMs = elapsed; }
    }
    public sealed class MwlMatchResult { public string state = "NOT_RUN", code = "NOT_RUN"; public int retained; public bool truncated; }
    public sealed class MwlScheduledProcedureStep {
        public string scheduledStationAe = "", scheduledDate = "", scheduledTime = "", modality = "", scheduledLocation = "";
    }
    public sealed class MwlDecodingWarning {
        public string code = "", tag = "", keyword = "", characterSet = "";
    }
    public sealed class MwlItem {
        public string patientName = "", patientId = "", accessionNumber = "", requestedProcedureId = "", requestedProcedureDescription = "";
        public string specificCharacterSet = "";
        public List<MwlDecodingWarning> decodingWarnings = new List<MwlDecodingWarning>();
        public MwlScheduledProcedureStep scheduledProcedureStep = new MwlScheduledProcedureStep();
    }
    public sealed class MwlQueryResult {
        public string classification = "FAILED", resolvedAddress = "";
        public MwlLayerResult dns = new MwlLayerResult(), tcp = new MwlLayerResult(), association = new MwlLayerResult(), cfind = new MwlLayerResult(), cancellation = new MwlLayerResult();
        public MwlMatchResult matches = new MwlMatchResult();
        public List<MwlItem> items = new List<MwlItem>();
        public List<MwlDecodingWarning> warnings = new List<MwlDecodingWarning>();
    }
    public static class MwlQueryClient {
        const string Mwl = "1.2.840.10008.5.1.4.31", Implicit = "1.2.840.10008.1.2", Explicit = "1.2.840.10008.1.2.1", Application = "1.2.840.10008.3.1.1.1";
        sealed class Pdu { public byte type; public byte[] body; }
        static void Require(bool value) { if (!value) throw new InvalidDataException("MWL_PROTOCOL_ERROR"); }
        static byte[] Join(params byte[][] parts) { using (var stream = new MemoryStream()) { foreach (byte[] part in parts) stream.Write(part, 0, part.Length); return stream.ToArray(); } }
        static byte[] Be32(uint value) { return new byte[] { (byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value }; }
        static byte[] Le16(ushort value) { return new byte[] { (byte)value, (byte)(value >> 8) }; }
        static byte[] Le32(uint value) { return new byte[] { (byte)value, (byte)(value >> 8), (byte)(value >> 16), (byte)(value >> 24) }; }
        static ushort U16(byte[] bytes, int offset) { Require(offset >= 0 && offset + 2 <= bytes.Length); return (ushort)(bytes[offset] | bytes[offset + 1] << 8); }
        static uint U32(byte[] bytes, int offset) { Require(offset >= 0 && offset + 4 <= bytes.Length); return (uint)(bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24); }
        static uint BeU32(byte[] bytes, int offset) { Require(offset >= 0 && offset + 4 <= bytes.Length); return ((uint)bytes[offset] << 24) | ((uint)bytes[offset + 1] << 16) | ((uint)bytes[offset + 2] << 8) | bytes[offset + 3]; }
        static byte[] Slice(byte[] bytes, int offset, int length) { Require(offset >= 0 && length >= 0 && offset <= bytes.Length - length); byte[] result = new byte[length]; Buffer.BlockCopy(bytes, offset, result, 0, length); return result; }
        static byte[] Item(byte type, byte[] body) { return Join(new byte[] { type, 0, (byte)(body.Length >> 8), (byte)body.Length }, body); }
        static byte[] CommandElement(ushort element, byte[] value) { return Join(new byte[] { 0, 0 }, Le16(element), Le32((uint)value.Length), value); }
        static byte[] DatasetElement(ushort group, ushort element, string value) { byte[] raw = Encoding.ASCII.GetBytes(value ?? ""); if ((raw.Length & 1) != 0) raw = Join(raw, new byte[] { 0x20 }); return Join(Le16(group), Le16(element), Le32((uint)raw.Length), raw); }
        static byte[] ReadExact(NetworkStream stream, int count) { byte[] value = new byte[count]; int offset = 0; while (offset < count) { int read = stream.Read(value, offset, count - offset); if (read == 0) throw new EndOfStreamException(); offset += read; } return value; }
        static Pdu ReadPdu(NetworkStream stream) { byte[] header = ReadExact(stream, 6); uint length = BeU32(header, 2); Require(length <= 1048576); return new Pdu { type = header[0], body = ReadExact(stream, (int)length) }; }
        static void WritePdu(NetworkStream stream, byte type, byte[] body) { byte[] value = Join(new byte[] { type, 0 }, Be32((uint)body.Length), body); stream.Write(value, 0, value.Length); stream.Flush(); }
        static int BeU16(byte[] bytes, int offset) { Require(offset + 2 <= bytes.Length); return bytes[offset] << 8 | bytes[offset + 1]; }
        static void Associate(NetworkStream stream, MwlQueryRequest request) {
            byte[] fixedPart = new byte[68]; fixedPart[1] = 1;
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(request.calledAe.PadRight(16)), 0, fixedPart, 4, 16);
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(request.callingAe.PadRight(16)), 0, fixedPart, 20, 16);
            byte[] context = Item(0x20, Join(new byte[] { 1, 0, 0, 0 }, Item(0x30, Encoding.ASCII.GetBytes(Mwl)), Item(0x40, Encoding.ASCII.GetBytes(Explicit)), Item(0x40, Encoding.ASCII.GetBytes(Implicit))));
            WritePdu(stream, 1, Join(fixedPart, Item(0x10, Encoding.ASCII.GetBytes(Application)), context, Item(0x50, Item(0x51, Be32(16384)))));
            Pdu response = ReadPdu(stream); Require(response.type == 2 && response.body.Length >= 68);
            bool application = false, contextAccepted = false;
            for (int p = 68; p < response.body.Length;) {
                Require(p + 4 <= response.body.Length); int type = response.body[p], length = BeU16(response.body, p + 2); byte[] body = Slice(response.body, p + 4, length); p += 4 + length;
                if (type == 0x10) application = Encoding.ASCII.GetString(body) == Application;
                if (type == 0x21) { Require(body.Length >= 4 && body[0] == 1 && body[2] == 0); for (int q = 4; q < body.Length;) { int subLength = BeU16(body, q + 2); if (body[q] == 0x40) contextAccepted = Encoding.ASCII.GetString(body, q + 4, subLength) == Implicit; q += 4 + subLength; } }
            }
            Require(application && contextAccepted);
        }
        static void SendFind(NetworkStream stream, MwlQueryRequest request) {
            byte[] fields = Join(CommandElement(0x0002, Encoding.ASCII.GetBytes(Mwl + "\0")), CommandElement(0x0100, Le16(0x0020)), CommandElement(0x0110, Le16(1)), CommandElement(0x0700, Le16(0)), CommandElement(0x0800, Le16(0)));
            byte[] command = Join(CommandElement(0, Le32((uint)fields.Length)), fields);
            byte[] dataset = Join(DatasetElement(0x0040, 0x0002, request.scheduledDate), DatasetElement(0x0010, 0x0010, ""), DatasetElement(0x0010, 0x0020, ""));
            byte[] commandPdv = Join(Be32((uint)command.Length + 2), new byte[] { 1, 3 }, command);
            byte[] dataPdv = Join(Be32((uint)dataset.Length + 2), new byte[] { 1, 2 }, dataset);
            WritePdu(stream, 4, Join(commandPdv, dataPdv));
        }
        static void SendCancel(NetworkStream stream) {
            byte[] fields = Join(CommandElement(0x0100, Le16(0x0fff)), CommandElement(0x0120, Le16(1)), CommandElement(0x0800, Le16(0x0101)));
            byte[] command = Join(CommandElement(0, Le32((uint)fields.Length)), fields);
            WritePdu(stream, 4, Join(Be32((uint)command.Length + 2), new byte[] { 1, 3 }, command));
        }
        static Dictionary<ushort, byte[]> ParseCommand(byte[] bytes) {
            var values = new Dictionary<ushort, byte[]>();
            for (int p = 0; p < bytes.Length;) { Require(p + 8 <= bytes.Length && U16(bytes, p) == 0); ushort tag = U16(bytes, p + 2); uint length = U32(bytes, p + 4); p += 8; Require(length <= bytes.Length - p); values[tag] = Slice(bytes, p, (int)length); p += (int)length; }
            return values;
        }
        static readonly Encoding StrictAscii = Encoding.GetEncoding(20127, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
        static readonly Encoding StrictLatin1 = Encoding.GetEncoding(28591, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
        static readonly Encoding StrictUtf8 = new UTF8Encoding(false, true);
        static string StrictText(Encoding encoding, byte[] bytes, int offset, int length) { return encoding.GetString(bytes, offset, length).TrimEnd(' ', '\0'); }
        static string FindCharacterSet(byte[] bytes, int start, int end) {
            for (int p = start; p < end;) {
                Require(p + 8 <= end); ushort group = U16(bytes, p), element = U16(bytes, p + 2); uint length = U32(bytes, p + 4); p += 8; Require(length <= end - p);
                if (group == 0x0008 && element == 0x0005) { try { return StrictText(StrictAscii, bytes, p, (int)length); } catch (DecoderFallbackException) { return "INVALID"; } }
                p += (int)length;
            }
            return "";
        }
        static Encoding CharacterEncoding(string characterSet) {
            if (characterSet == "" || characterSet == "ISO_IR 6") return StrictAscii;
            if (characterSet == "ISO_IR 100") return StrictLatin1;
            if (characterSet == "ISO_IR 192") return StrictUtf8;
            return null;
        }
        static string DecodeField(byte[] bytes, int offset, int length, string characterSet, bool usesCharacterSet, string tag, string keyword, MwlItem item, MwlQueryResult result) {
            Encoding encoding = usesCharacterSet ? CharacterEncoding(characterSet) : StrictAscii;
            string code = encoding == null ? "CHARACTER_SET_NOT_SUPPORTED" : "TEXT_DECODING_FAILED";
            try { if (encoding != null) return StrictText(encoding, bytes, offset, length); }
            catch (DecoderFallbackException) { }
            var warning = new MwlDecodingWarning { code = code, tag = tag, keyword = keyword, characterSet = characterSet == "" ? "DICOM_DEFAULT" : characterSet };
            item.decodingWarnings.Add(warning); result.warnings.Add(warning);
            return code;
        }
        static void ParseElements(byte[] bytes, int start, int end, MwlItem item, bool step, string characterSet, MwlQueryResult result) {
            for (int p = start; p < end;) {
                Require(p + 8 <= end); ushort group = U16(bytes, p), element = U16(bytes, p + 2); uint length = U32(bytes, p + 4); p += 8; Require(length <= end - p);
                if (group == 0x0040 && element == 0x0100) { Require(length >= 8 && U16(bytes, p) == 0xfffe && U16(bytes, p + 2) == 0xe000); uint itemLength = U32(bytes, p + 4); Require(itemLength <= length - 8); ParseElements(bytes, p + 8, p + 8 + (int)itemLength, item, true, characterSet, result); }
                else if (!step && group == 0x0010 && element == 0x0010) item.patientName = DecodeField(bytes, p, (int)length, characterSet, true, "0010,0010", "PatientName", item, result);
                else if (!step && group == 0x0010 && element == 0x0020) item.patientId = DecodeField(bytes, p, (int)length, characterSet, true, "0010,0020", "PatientID", item, result);
                else if (!step && group == 0x0008 && element == 0x0050) item.accessionNumber = DecodeField(bytes, p, (int)length, characterSet, true, "0008,0050", "AccessionNumber", item, result);
                else if (!step && group == 0x0040 && element == 0x1001) item.requestedProcedureId = DecodeField(bytes, p, (int)length, characterSet, true, "0040,1001", "RequestedProcedureID", item, result);
                else if (!step && group == 0x0032 && element == 0x1060) item.requestedProcedureDescription = DecodeField(bytes, p, (int)length, characterSet, true, "0032,1060", "RequestedProcedureDescription", item, result);
                else if (step && group == 0x0040 && element == 0x0001) item.scheduledProcedureStep.scheduledStationAe = DecodeField(bytes, p, (int)length, characterSet, false, "0040,0001", "ScheduledStationAETitle", item, result);
                else if (step && group == 0x0040 && element == 0x0002) item.scheduledProcedureStep.scheduledDate = DecodeField(bytes, p, (int)length, characterSet, false, "0040,0002", "ScheduledProcedureStepStartDate", item, result);
                else if (step && group == 0x0040 && element == 0x0003) item.scheduledProcedureStep.scheduledTime = DecodeField(bytes, p, (int)length, characterSet, false, "0040,0003", "ScheduledProcedureStepStartTime", item, result);
                else if (step && group == 0x0008 && element == 0x0060) item.scheduledProcedureStep.modality = DecodeField(bytes, p, (int)length, characterSet, false, "0008,0060", "Modality", item, result);
                else if (step && group == 0x0040 && element == 0x0011) item.scheduledProcedureStep.scheduledLocation = DecodeField(bytes, p, (int)length, characterSet, true, "0040,0011", "ScheduledProcedureStepLocation", item, result);
                p += (int)length;
            }
        }
        static void SetTruncated(MwlQueryResult result) {
            result.matches.state = "SUCCESS"; result.matches.code = "MATCH_LIMIT_REACHED"; result.matches.retained = 100; result.matches.truncated = true; result.classification = "SUCCESS_TRUNCATED";
        }
        static void SetCancellation(MwlQueryResult result, string code, string detail) {
            result.cancellation.Set(code == "CANCEL_CONFIRMED" ? "SUCCESS" : "WARNING", code, detail, 0);
        }
        static bool IsTimeout(IOException error) {
            SocketException socket = error.InnerException as SocketException;
            return socket != null && socket.SocketErrorCode == SocketError.TimedOut;
        }
        static void ReadResponses(NetworkStream stream, MwlQueryResult result, int timeoutMs) {
            bool truncated = false;
            var cancellationClock = new Stopwatch();
            while (true) {
                Pdu pdu;
                try {
                    if (truncated) {
                        int remaining = timeoutMs - (int)cancellationClock.ElapsedMilliseconds;
                        if (remaining <= 0) { SetCancellation(result, "CANCEL_TIMEOUT", "The bounded cancellation deadline elapsed without a terminal response."); return; }
                        stream.ReadTimeout = remaining;
                    }
                    pdu = ReadPdu(stream);
                } catch (EndOfStreamException) {
                    if (!truncated) throw;
                    SetCancellation(result, "ASSOCIATION_CLOSED_AFTER_CANCEL", "The association closed after C-CANCEL; retained results were preserved."); return;
                } catch (IOException error) {
                    if (!truncated) throw;
                    if (IsTimeout(error)) SetCancellation(result, "CANCEL_TIMEOUT", "The bounded cancellation deadline elapsed without a terminal response.");
                    else SetCancellation(result, "CANCEL_SEND_FAILED", "The connection reset at the C-CANCEL write boundary; retained results were preserved.");
                    return;
                }
                Require(pdu.type == 4); byte[] command = null, dataset = null;
                for (int p = 0; p < pdu.body.Length;) { uint length = BeU32(pdu.body, p); p += 4; Require(length >= 2 && length <= pdu.body.Length - p); byte context = pdu.body[p], control = pdu.body[p + 1]; Require(context == 1 && (control & 2) != 0); byte[] value = Slice(pdu.body, p + 2, (int)length - 2); if ((control & 1) != 0) command = value; else dataset = value; p += (int)length; }
                Require(command != null); Dictionary<ushort, byte[]> fields = ParseCommand(command);
                Require(fields.ContainsKey(0x0100) && U16(fields[0x0100], 0) == 0x8020 && fields.ContainsKey(0x0120) && U16(fields[0x0120], 0) == 1 && fields.ContainsKey(0x0900));
                ushort status = U16(fields[0x0900], 0); result.cfind.dicomStatus = "0x" + status.ToString("X4");
                if (status == 0xff00 || status == 0xff01) {
                    Require(dataset != null);
                    if (!truncated) {
                        var item = new MwlItem(); item.specificCharacterSet = FindCharacterSet(dataset, 0, dataset.Length); ParseElements(dataset, 0, dataset.Length, item, false, item.specificCharacterSet, result); result.items.Add(item);
                        if (result.items.Count == 100) {
                            truncated = true; SetTruncated(result); cancellationClock.Start();
                            try { SendCancel(stream); }
                            catch (IOException) { SetCancellation(result, "CANCEL_SEND_FAILED", "C-CANCEL could not be sent; retained results were preserved."); return; }
                            catch (ObjectDisposedException) { SetCancellation(result, "CANCEL_SEND_FAILED", "C-CANCEL could not be sent; retained results were preserved."); return; }
                        }
                    }
                    continue;
                }
                if (truncated) {
                    result.cfind.dicomStatus = "0x" + status.ToString("X4");
                    if (status == 0xfe00) {
                        result.cfind.Set("SUCCESS", "C_FIND_CANCELLED", "The peer confirmed the bounded C-FIND cancellation.", 0);
                        SetCancellation(result, "CANCEL_CONFIRMED", "The peer returned the C-FIND cancel status.");
                    } else {
                        result.cfind.Set("SUCCESS", "C_FIND_FINAL_RESPONSE", "A terminal C-FIND response raced with cancellation.", 0);
                        SetCancellation(result, "FINAL_RESPONSE_RACED_CANCEL", "A terminal response arrived at the cancellation boundary.");
                    }
                    return;
                }
                if (status == 0) { result.cfind.Set("SUCCESS", "C_FIND_SUCCESS", "The correlated C-FIND completed successfully.", 0); result.matches.state = "SUCCESS"; result.matches.code = result.items.Count == 0 ? "ZERO_MATCHES" : "MATCHES_RETAINED"; result.matches.retained = result.items.Count; result.classification = result.items.Count == 0 ? "SUCCESS_ZERO_MATCHES" : "SUCCESS_MATCHES"; return; }
                result.cfind.Set("FAILED", status == 0xa900 ? "C_FIND_IDENTIFIER_REJECTED" : "C_FIND_FAILED", "The peer returned a terminal C-FIND failure status.", 0); result.classification = result.cfind.code; return;
            }
        }
        public static MwlQueryResult Run(MwlQueryRequest request) {
            var result = new MwlQueryResult(); TcpClient client = null; var phase = Stopwatch.StartNew();
            try {
                IPAddress address;
                if (IPAddress.TryParse(request.host, out address)) result.dns.Set("SUCCESS", "NOT_REQUIRED", "IP literal supplied; DNS was not required.", 0);
                else { IPAddress[] addresses = Dns.GetHostAddresses(request.host); Require(addresses.Length > 0); address = addresses[0]; result.dns.Set("SUCCESS", "RESOLVED", "DNS resolved to one selected address.", phase.ElapsedMilliseconds); }
                result.resolvedAddress = address.ToString(); phase.Restart(); client = new TcpClient(address.AddressFamily); IAsyncResult connect = client.BeginConnect(address, request.port, null, null); if (!connect.AsyncWaitHandle.WaitOne(request.timeoutMs)) throw new TimeoutException(); client.EndConnect(connect); connect.AsyncWaitHandle.Close(); result.tcp.Set("SUCCESS", "TCP_CONNECTED", "One TCP connection was established.", phase.ElapsedMilliseconds);
                NetworkStream stream = client.GetStream(); stream.ReadTimeout = request.timeoutMs; stream.WriteTimeout = request.timeoutMs; phase.Restart(); Associate(stream, request); result.association.Set("SUCCESS", "ASSOCIATION_ACCEPTED", "Association accepted with an MWL presentation context.", phase.ElapsedMilliseconds); phase.Restart(); SendFind(stream, request); ReadResponses(stream, result, request.timeoutMs); try { WritePdu(stream, 5, new byte[4]); } catch { }
            } finally { if (client != null) client.Close(); }
            return result;
        }
    }
}
