///| Extract the MoonBit AST of `source` as JSON, with source locations.
pub fn extract(source : String) -> String {
  @basic.show_loc.val = @basic.LocStyle::Json
  let (impls, _) = @parser.parse_string(source)
  impls.to_json().stringify()
}
