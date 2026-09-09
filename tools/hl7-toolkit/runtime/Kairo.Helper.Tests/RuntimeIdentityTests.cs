using Xunit;

namespace Kairo.Helper.Tests;

public sealed class RuntimeIdentityTests
{
    [Fact]
    public void ReportsApprovedWorkstationRuntimeBuildIdentity()
    {
        Assert.Equal("Kairo HL7 Toolkit", RuntimeIdentity.ProductName);
        Assert.Equal("0.7.3", RuntimeIdentity.FeatureVersion);
        Assert.Equal(1, RuntimeIdentity.RuntimeBuild);
        Assert.Equal(
            "714e5c9d24a471f0c39e95e65441d2416e65ad53",
            RuntimeIdentity.SourceCheckpoint);
        Assert.Equal(
            "Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 1",
            RuntimeIdentity.DisplayName);
    }
}
