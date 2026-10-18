# Homebrew formula for Forge CLI
# This is a reference template — the live formula is auto-managed in
# seanfraserio/homebrew-tap via the brew-release GitHub Actions workflow.
#
# Intentionally pinned to the latest installable published CLI, 0.2.5.
# Registry tarball SHA-256 and npm integrity verified 2026-10-18; an isolated
# npm install and forgeai --version/--help also passed. Published 0.2.6 and
# 0.2.7 contain unresolved workspace:* dependencies and cannot be installed
# by npm. This legacy reference does not contain the current source fixes.
# The live tap is managed independently; this file does not update it.
#
# Install: brew tap seanfraserio/tap && brew install forgeai

class Forgeai < Formula
  desc "Agent infrastructure as code — the Terraform for AI agents"
  homepage "https://github.com/seanfraserio/forge"
  url "https://registry.npmjs.org/@openforge-ai/cli/-/cli-0.2.5.tgz"
  sha256 "28ead4be1aeb0f98e9b2dd9b6a5bf5479b5138dba5c2b2f62a8e2a17ff80a81c"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/forgeai --version")
  end
end
