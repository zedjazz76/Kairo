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
    public sealed class StudyQueryRequest {
        public string host, callingAe, calledAe, accessionNumber, patientId, studyInstanceUid, studyDate, studyDateRange, modalitiesInStudy;
        public int port, timeoutMs;
    }
    public sealed class StudyTag { public string tag = "", value = ""; public List<string> path = new List<string>(); }
    public sealed class StudyItem {
        public string patientName = "", patientId = "", accessionNumber = "", studyDate = "", studyTime = "", studyDescription = "", modalitiesInStudy = "", studyInstanceUid = "", numberOfStudyRelatedSeries = "", numberOfStudyRelatedInstances = "", referringPhysicianName = "", specificCharacterSet = "";
        public List<StudyTag> tags = new List<StudyTag>();
        public List<MwlDecodingWarning> decodingWarnings = new List<MwlDecodingWarning>();
    }
    public sealed class StudyQueryResult {
        public string classification = "FAILED", resolvedAddress = "", queryRetrieveLevel = "STUDY", sopClassUid = "1.2.840.10008.5.1.4.1.2.2.1", acceptedTransferSyntax = "";
        public MwlLayerResult dns = new MwlLayerResult(), tcp = new MwlLayerResult(), association = new MwlLayerResult(), cfind = new MwlLayerResult(), cancellation = new MwlLayerResult();
        public MwlMatchResult matches = new MwlMatchResult();
        public List<StudyItem> items = new List<StudyItem>();
        public List<MwlDecodingWarning> warnings = new List<MwlDecodingWarning>();
    }
    internal static class DicomFindCore {
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
        const string StudyRoot = "1.2.840.10008.5.1.4.1.2.2.1";
        static string AssociateStudy(NetworkStream stream, StudyQueryRequest request) {
            byte[] fixedPart = new byte[68]; fixedPart[1] = 1;
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(request.calledAe.PadRight(16)), 0, fixedPart, 4, 16);
            Buffer.BlockCopy(Encoding.ASCII.GetBytes(request.callingAe.PadRight(16)), 0, fixedPart, 20, 16);
            byte[] context = Item(0x20, Join(new byte[] { 1, 0, 0, 0 }, Item(0x30, Encoding.ASCII.GetBytes(StudyRoot)), Item(0x40, Encoding.ASCII.GetBytes(Explicit)), Item(0x40, Encoding.ASCII.GetBytes(Implicit))));
            byte[] user = Item(0x50, Join(Item(0x51, Be32(16384)), Item(0x52, Encoding.ASCII.GetBytes("2.25.25815942481606045106159218101014368293")), Item(0x55, Encoding.ASCII.GetBytes("KAIRO_STAGE7"))));
            WritePdu(stream, 1, Join(fixedPart, Item(0x10, Encoding.ASCII.GetBytes(Application)), context, user));
            Pdu response = ReadPdu(stream);
            if (response.type == 3) throw new InvalidDataException("STUDY_ASSOCIATION_REJECTED");
            if (response.type != 2 || response.body.Length < 68) throw new InvalidDataException("STUDY_ASSOCIATION_MALFORMED");
            bool application = false; string syntax = ""; bool accepted = false;
            for (int p = 68; p < response.body.Length;) {
                if (p + 4 > response.body.Length) throw new InvalidDataException("STUDY_ASSOCIATION_MALFORMED");
                int type = response.body[p], length = BeU16(response.body, p + 2); byte[] body = Slice(response.body, p + 4, length); p += 4 + length;
                if (type == 0x10) application = Encoding.ASCII.GetString(body) == Application;
                if (type == 0x21) {
                    if (body.Length < 4 || body[0] != 1) throw new InvalidDataException("STUDY_ASSOCIATION_MALFORMED");
                    accepted = body[2] == 0;
                    for (int q = 4; q < body.Length;) { if (q + 4 > body.Length) throw new InvalidDataException("STUDY_ASSOCIATION_MALFORMED"); int subLength = BeU16(body, q + 2); if (q + 4 + subLength > body.Length) throw new InvalidDataException("STUDY_ASSOCIATION_MALFORMED"); if (body[q] == 0x40) syntax = Encoding.ASCII.GetString(body, q + 4, subLength); q += 4 + subLength; }
                }
            }
            if (!application || !accepted) throw new InvalidDataException("STUDY_PRESENTATION_CONTEXT_REJECTED");
            if (syntax != Implicit && syntax != Explicit) throw new InvalidDataException("STUDY_TRANSFER_SYNTAX_REJECTED");
            return syntax;
        }
        static byte[] ExplicitElement(ushort group, ushort element, string vr, string value) {
            byte[] raw = Encoding.ASCII.GetBytes(value ?? ""); if ((raw.Length & 1) != 0) raw = Join(raw, new byte[] { vr == "UI" ? (byte)0 : (byte)0x20 });
            return Join(Le16(group), Le16(element), Encoding.ASCII.GetBytes(vr), Le16((ushort)raw.Length), raw);
        }
        static byte[] StudyElement(ushort group, ushort element, string vr, string value, string syntax) { return syntax == Explicit ? ExplicitElement(group, element, vr, value) : DatasetElement(group, element, value); }
        static void SendStudyFind(NetworkStream stream, StudyQueryRequest request, string syntax) {
            byte[] fields = Join(CommandElement(0x0002, Encoding.ASCII.GetBytes(StudyRoot + "\0")), CommandElement(0x0100, Le16(0x0020)), CommandElement(0x0110, Le16(1)), CommandElement(0x0700, Le16(0)), CommandElement(0x0800, Le16(0)));
            byte[] command = Join(CommandElement(0, Le32((uint)fields.Length)), fields);
            var elements = new List<byte[]>();
            elements.Add(StudyElement(0x0008, 0x0052, "CS", "STUDY", syntax));
            if (!String.IsNullOrEmpty(request.accessionNumber)) elements.Add(StudyElement(0x0008, 0x0050, "SH", request.accessionNumber, syntax));
            if (!String.IsNullOrEmpty(request.patientId)) elements.Add(StudyElement(0x0010, 0x0020, "LO", request.patientId, syntax));
            if (!String.IsNullOrEmpty(request.studyInstanceUid)) elements.Add(StudyElement(0x0020, 0x000d, "UI", request.studyInstanceUid, syntax));
            string date = !String.IsNullOrEmpty(request.studyDate) ? request.studyDate : request.studyDateRange;
            if (!String.IsNullOrEmpty(date)) elements.Add(StudyElement(0x0008, 0x0020, "DA", date, syntax));
            if (!String.IsNullOrEmpty(request.modalitiesInStudy)) elements.Add(StudyElement(0x0008, 0x0061, "CS", request.modalitiesInStudy, syntax));
            foreach (var key in new [] { new { g=(ushort)0x0010,e=(ushort)0x0010,vr="PN" }, new { g=(ushort)0x0008,e=(ushort)0x0030,vr="TM" }, new { g=(ushort)0x0008,e=(ushort)0x1030,vr="LO" }, new { g=(ushort)0x0008,e=(ushort)0x0090,vr="PN" }, new { g=(ushort)0x0020,e=(ushort)0x1206,vr="IS" }, new { g=(ushort)0x0020,e=(ushort)0x1208,vr="IS" } }) elements.Add(StudyElement(key.g, key.e, key.vr, "", syntax));
            if (String.IsNullOrEmpty(request.patientId)) elements.Add(StudyElement(0x0010, 0x0020, "LO", "", syntax));
            if (String.IsNullOrEmpty(request.accessionNumber)) elements.Add(StudyElement(0x0008, 0x0050, "SH", "", syntax));
            if (String.IsNullOrEmpty(request.studyInstanceUid)) elements.Add(StudyElement(0x0020, 0x000d, "UI", "", syntax));
            if (String.IsNullOrEmpty(date)) elements.Add(StudyElement(0x0008, 0x0020, "DA", "", syntax));
            if (String.IsNullOrEmpty(request.modalitiesInStudy)) elements.Add(StudyElement(0x0008, 0x0061, "CS", "", syntax));
            elements.Sort(delegate(byte[] left, byte[] right) { int group = U16(left, 0).CompareTo(U16(right, 0)); return group != 0 ? group : U16(left, 2).CompareTo(U16(right, 2)); });
            byte[] dataset = Join(elements.ToArray());
            WritePdu(stream, 4, Join(Join(Be32((uint)command.Length + 2), new byte[] { 1, 3 }, command), Join(Be32((uint)dataset.Length + 2), new byte[] { 1, 2 }, dataset)));
        }
        static void AddStudyValue(StudyItem item, StudyQueryResult result, ushort group, ushort element, string value) {
            string tag = group.ToString("X4") + element.ToString("X4"); item.tags.Add(new StudyTag { tag = tag, value = value });
            if (group == 0x0010 && element == 0x0010) item.patientName = value;
            else if (group == 0x0010 && element == 0x0020) item.patientId = value;
            else if (group == 0x0008 && element == 0x0050) item.accessionNumber = value;
            else if (group == 0x0008 && element == 0x0020) item.studyDate = value;
            else if (group == 0x0008 && element == 0x0030) item.studyTime = value;
            else if (group == 0x0008 && element == 0x1030) item.studyDescription = value;
            else if (group == 0x0008 && element == 0x0061) item.modalitiesInStudy = value;
            else if (group == 0x0020 && element == 0x000d) item.studyInstanceUid = value;
            else if (group == 0x0020 && element == 0x1206) item.numberOfStudyRelatedSeries = value;
            else if (group == 0x0020 && element == 0x1208) item.numberOfStudyRelatedInstances = value;
            else if (group == 0x0008 && element == 0x0090) item.referringPhysicianName = value;
        }
        static StudyItem ParseStudy(byte[] bytes, string syntax, StudyQueryResult result) {
            if (bytes.Length > 1048576) throw new InvalidDataException("STUDY_RESPONSE_TOO_LARGE");
            var entries = new List<Tuple<ushort,ushort,int,int>>(); string characterSet = ""; int p = 0;
            while (p < bytes.Length) {
                if (entries.Count >= 256 || p + 8 > bytes.Length) throw new InvalidDataException("STUDY_DATASET_MALFORMED");
                ushort group=U16(bytes,p), element=U16(bytes,p+2); int header=8; uint length;
                if (syntax == Explicit) { length=U16(bytes,p+6); } else length=U32(bytes,p+4);
                if (length > 65536 || length > bytes.Length - p - header) throw new InvalidDataException("STUDY_DATASET_MALFORMED");
                entries.Add(Tuple.Create(group,element,p+header,(int)length));
                if (group==0x0008 && element==0x0005) { try { characterSet=StrictText(StrictAscii,bytes,p+header,(int)length); } catch { characterSet="INVALID"; } }
                p += header + (int)length;
            }
            var item = new StudyItem(); item.specificCharacterSet=characterSet; Encoding textEncoding=CharacterEncoding(characterSet);
            foreach(var entry in entries) {
                ushort group=entry.Item1, element=entry.Item2; if (group==0x0008 && element==0x0005) { AddStudyValue(item,result,group,element,characterSet); continue; }
                bool known=(group==0x0010&&(element==0x0010||element==0x0020))||(group==0x0008&&(element==0x0050||element==0x0020||element==0x0030||element==0x1030||element==0x0061||element==0x0090))||(group==0x0020&&(element==0x000d||element==0x1206||element==0x1208));
                if(!known) continue; bool charsetText=(group==0x0010)||(group==0x0008&&(element==0x0050||element==0x1030||element==0x0090)); Encoding encoding=charsetText?textEncoding:StrictAscii; string value; string code=encoding==null?"CHARACTER_SET_NOT_SUPPORTED":"TEXT_DECODING_FAILED";
                try { if(encoding==null) throw new DecoderFallbackException(); value=StrictText(encoding,bytes,entry.Item3,entry.Item4); }
                catch { value=code; var warning=new MwlDecodingWarning{code=code,tag=group.ToString("X4")+","+element.ToString("X4"),keyword="StudyAttribute",characterSet=characterSet==""?"DICOM_DEFAULT":characterSet}; item.decodingWarnings.Add(warning); result.warnings.Add(warning); }
                AddStudyValue(item,result,group,element,value);
            }
            return item;
        }
        static void ReadStudyResponses(NetworkStream stream, StudyQueryResult result, int timeoutMs, string syntax) {
            bool truncated=false; var clock=new Stopwatch();var commandBuffer=new MemoryStream();var datasetBuffer=new MemoryStream();bool commandDone=false,dataDone=false;
            while(true) {
                Pdu pdu;
                try { if(truncated){int remaining=timeoutMs-(int)clock.ElapsedMilliseconds;if(remaining<=0){SetStudyCancel(result,"CANCEL_TIMEOUT");return;}stream.ReadTimeout=remaining;} pdu=ReadPdu(stream); }
                catch(EndOfStreamException){if(!truncated)throw;SetStudyCancel(result,"ASSOCIATION_CLOSED_AFTER_CANCEL");return;}
                catch(IOException){if(!truncated)throw;SetStudyCancel(result,"CANCEL_TIMEOUT");return;}
                if(pdu.type==7)throw new InvalidDataException("PEER_ABORT");if(pdu.type!=4) throw new InvalidDataException("STUDY_DIMSE_MALFORMED");
                for(int p=0;p<pdu.body.Length;){if(p+6>pdu.body.Length)throw new InvalidDataException("STUDY_DIMSE_MALFORMED");uint length=BeU32(pdu.body,p);p+=4;if(length<2||length>pdu.body.Length-p)throw new InvalidDataException("STUDY_DIMSE_MALFORMED");if(pdu.body[p]!=1)throw new InvalidDataException("STUDY_RESPONSE_MISMATCH");byte control=pdu.body[p+1];byte[] value=Slice(pdu.body,p+2,(int)length-2);MemoryStream target=(control&1)!=0?commandBuffer:datasetBuffer;target.Write(value,0,value.Length);if(target.Length>((control&1)!=0?65536:1048576))throw new InvalidDataException((control&1)!=0?"STUDY_COMMAND_TOO_LARGE":"STUDY_RESPONSE_TOO_LARGE");if((control&2)!=0){if((control&1)!=0)commandDone=true;else dataDone=true;}p+=(int)length;}
                if(!commandDone)continue;byte[] command=commandBuffer.ToArray();var fields=ParseCommand(command);
                if(!fields.ContainsKey(0x0100)||U16(fields[0x0100],0)!=0x8020||!fields.ContainsKey(0x0120)||U16(fields[0x0120],0)!=1||!fields.ContainsKey(0x0900))throw new InvalidDataException("STUDY_RESPONSE_MISMATCH");
                bool expectsDataset=fields.ContainsKey(0x0800)&&U16(fields[0x0800],0)!=0x0101;if(expectsDataset&&!dataDone)continue;byte[] dataset=expectsDataset?datasetBuffer.ToArray():null;commandBuffer.SetLength(0);datasetBuffer.SetLength(0);commandDone=false;dataDone=false;
                ushort status=U16(fields[0x0900],0);result.cfind.dicomStatus="0x"+status.ToString("X4");
                if(status==0xff00||status==0xff01){if(dataset==null)throw new InvalidDataException("STUDY_DATASET_MISSING");if(status==0xff01)result.warnings.Add(new MwlDecodingWarning{code="C_FIND_PENDING_WARNING",tag="",keyword="CFindStatus",characterSet=""});if(!truncated){result.items.Add(ParseStudy(dataset,syntax,result));if(result.items.Count==100){truncated=true;result.matches.state="SUCCESS";result.matches.code="MATCH_LIMIT_REACHED";result.matches.retained=100;result.matches.truncated=true;result.classification="SUCCESS_TRUNCATED";clock.Start();try{SendCancel(stream);}catch{SetStudyCancel(result,"CANCEL_SEND_FAILED");return;}}}continue;}
                if(truncated){result.cfind.Set("SUCCESS",status==0xfe00?"C_FIND_CANCELLED":"C_FIND_FINAL_RESPONSE","The bounded query reached a terminal response.",0);SetStudyCancel(result,status==0xfe00?"CANCEL_CONFIRMED":"FINAL_RESPONSE_RACED_CANCEL");return;}
                if(status==0){result.cfind.Set("SUCCESS","C_FIND_SUCCESS","The correlated Study Root C-FIND completed successfully.",0);result.matches.state="SUCCESS";result.matches.code=result.items.Count==0?"ZERO_MATCHES":"MATCHES_RETAINED";result.matches.retained=result.items.Count;result.classification=result.items.Count==0?"SUCCESS_ZERO_MATCHES":"SUCCESS_MATCHES";return;}
                result.cfind.Set("FAILED",status==0xa900?"C_FIND_IDENTIFIER_REJECTED":"C_FIND_FAILED","The peer returned a terminal C-FIND failure status.",0);result.classification=result.cfind.code;return;
            }
        }
        static void SetStudyCancel(StudyQueryResult result,string code){result.cancellation.Set(code=="CANCEL_CONFIRMED"?"SUCCESS":"WARNING",code,"Bounded C-FIND cancellation evidence.",0);}
        public static StudyQueryResult RunStudy(StudyQueryRequest request) {
            var result=new StudyQueryResult();TcpClient client=null;var phase=Stopwatch.StartNew();string stage="DNS";
            try { IPAddress address;if(IPAddress.TryParse(request.host,out address))result.dns.Set("SUCCESS","NOT_REQUIRED","IP literal supplied; DNS was not required.",0);else{IPAddress[] addresses=Dns.GetHostAddresses(request.host);if(addresses.Length==0)throw new InvalidDataException("STUDY_DNS_FAILED");address=addresses[0];result.dns.Set("SUCCESS","RESOLVED","DNS resolved to one selected address.",phase.ElapsedMilliseconds);}result.resolvedAddress=address.ToString();stage="TCP";phase.Restart();client=new TcpClient(address.AddressFamily);IAsyncResult connect=client.BeginConnect(address,request.port,null,null);if(!connect.AsyncWaitHandle.WaitOne(request.timeoutMs))throw new TimeoutException();client.EndConnect(connect);connect.AsyncWaitHandle.Close();result.tcp.Set("SUCCESS","TCP_CONNECTED","One TCP connection was established.",phase.ElapsedMilliseconds);NetworkStream stream=client.GetStream();stream.ReadTimeout=request.timeoutMs;stream.WriteTimeout=request.timeoutMs;stage="ASSOCIATION";phase.Restart();string syntax=AssociateStudy(stream,request);result.acceptedTransferSyntax=syntax;result.association.Set("SUCCESS","ASSOCIATION_ACCEPTED","Association accepted with a Study Root FIND presentation context.",phase.ElapsedMilliseconds);stage="C_FIND";SendStudyFind(stream,request,syntax);ReadStudyResponses(stream,result,request.timeoutMs,syntax);try{WritePdu(stream,5,new byte[4]);}catch{}
            } catch(Exception error) { string code=error.Message.StartsWith("STUDY_")||error.Message=="PEER_ABORT"?error.Message:(error is TimeoutException?"TIMEOUT":(stage=="DNS"?"DNS_FAILED":stage=="TCP"?"CONNECTION_FAILED":stage=="ASSOCIATION"?"ASSOCIATION_FAILED":"C_FIND_FAILED"));MwlLayerResult layer=stage=="DNS"?result.dns:stage=="TCP"?result.tcp:stage=="ASSOCIATION"?result.association:result.cfind;layer.Set("FAILED",code,"The Study Root query stopped at this protocol layer.",phase.ElapsedMilliseconds);result.classification=code;
            } finally {if(client!=null)client.Close();}return result;
        }
        public static MwlQueryResult RunMwl(MwlQueryRequest request) {
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
    public static class MwlQueryClient { public static MwlQueryResult Run(MwlQueryRequest request) { return DicomFindCore.RunMwl(request); } }
    public static class StudyQueryClient { public static StudyQueryResult Run(StudyQueryRequest request) { return DicomFindCore.RunStudy(request); } }
}
