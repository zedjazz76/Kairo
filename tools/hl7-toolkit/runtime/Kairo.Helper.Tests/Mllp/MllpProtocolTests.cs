using Kairo.Helper.Mllp;
using Xunit;

namespace Kairo.Helper.Tests.Mllp;

public sealed class MllpProtocolTests
{
    [Fact]
    public void FramesExactlyOneNormalizedHl7Message()
    {
        byte[] frame = MllpProtocol.Frame("MSH|^~\\&|A\nPID|1", "utf-8", 11, [28, 13]);
        Assert.Equal(11, frame[0]);
        Assert.Equal(28, frame[^2]);
        Assert.Equal(13, frame[^1]);
        Assert.Contains((byte)13, frame[1..^2]);
        Assert.DoesNotContain((byte)10, frame[1..^2]);
    }

    [Fact]
    public void RejectsEmbeddedFramingMarkers() =>
        Assert.Throws<InvalidOperationException>(() => MllpProtocol.Frame("MSH|^~\\&|A\rOBX|\u000b", "utf-8", 11, [28, 13]));
}
