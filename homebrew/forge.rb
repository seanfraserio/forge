# Homebrew formula for Forge CLI
# This is a reference template — the live formula is auto-managed in
# seanfraserio/homebrew-tap via the brew-release GitHub Actions workflow.
#
# Install: brew tap seanfraserio/tap && brew install forge

class Forge < Formula
  desc "Agent infrastructure as code — the Terraform for AI agents"
  homepage "https://github.com/seanfraserio/forge"
  url "https://registry.npmjs.org/@forge-ai/cli/-/cli-0.1.0.tgz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/forge --version")
  end
end
