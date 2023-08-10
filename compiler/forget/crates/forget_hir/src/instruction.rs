use std::cell::RefCell;
use std::fmt::Display;
use std::rc::Rc;

use forget_estree::{BinaryOperator, JsValue};

use crate::{Function, IdentifierId, InstrIx, InstructionId, ScopeId, Type};

#[derive(Debug)]
pub struct Instruction {
    pub id: InstructionId,
    pub value: InstructionValue,
}

impl Instruction {
    pub fn each_identifier_store<F>(&mut self, mut f: F) -> ()
    where
        F: FnMut(&mut LValue) -> (),
    {
        match &mut self.value {
            InstructionValue::DeclareContext(instr) => {
                f(&mut instr.lvalue);
            }
            InstructionValue::DeclareLocal(instr) => {
                f(&mut instr.lvalue);
            }
            InstructionValue::StoreLocal(instr) => {
                f(&mut instr.lvalue);
            }
            InstructionValue::Array(_)
            | InstructionValue::Binary(_)
            | InstructionValue::Call(_)
            | InstructionValue::LoadContext(_)
            | InstructionValue::LoadGlobal(_)
            | InstructionValue::LoadLocal(_)
            | InstructionValue::Primitive(_)
            | InstructionValue::Function(_)
            | InstructionValue::JSXElement(_)
            | InstructionValue::Tombstone => {}
        }
    }

    pub fn try_each_identifier_store<F, E>(&mut self, mut f: F) -> Result<(), E>
    where
        F: FnMut(&mut LValue) -> Result<(), E>,
    {
        match &mut self.value {
            InstructionValue::DeclareContext(instr) => {
                f(&mut instr.lvalue)?;
            }
            InstructionValue::DeclareLocal(instr) => {
                f(&mut instr.lvalue)?;
            }
            InstructionValue::StoreLocal(instr) => {
                f(&mut instr.lvalue)?;
            }
            InstructionValue::Array(_)
            | InstructionValue::Binary(_)
            | InstructionValue::Call(_)
            | InstructionValue::LoadContext(_)
            | InstructionValue::LoadGlobal(_)
            | InstructionValue::LoadLocal(_)
            | InstructionValue::Primitive(_)
            | InstructionValue::Function(_)
            | InstructionValue::JSXElement(_)
            | InstructionValue::Tombstone => {}
        }
        Ok(())
    }

    pub fn each_identifier_load<F>(&mut self, mut f: F) -> ()
    where
        F: FnMut(&mut IdentifierOperand) -> (),
    {
        match &mut self.value {
            InstructionValue::LoadLocal(instr) => f(&mut instr.place),
            InstructionValue::Array(_)
            | InstructionValue::Binary(_)
            | InstructionValue::Call(_)
            | InstructionValue::DeclareContext(_)
            | InstructionValue::DeclareLocal(_)
            | InstructionValue::LoadContext(_)
            | InstructionValue::LoadGlobal(_)
            | InstructionValue::Primitive(_)
            | InstructionValue::StoreLocal(_)
            | InstructionValue::Function(_)
            | InstructionValue::JSXElement(_)
            | InstructionValue::Tombstone => {}
        }
    }

    pub fn each_operand<F>(&mut self, mut f: F) -> ()
    where
        F: FnMut(&mut Operand) -> (),
    {
        match &mut self.value {
            InstructionValue::Array(value) => {
                for item in &mut value.elements {
                    match item {
                        Some(PlaceOrSpread::Place(item)) => f(item),
                        Some(PlaceOrSpread::Spread(item)) => f(item),
                        None => {}
                    }
                }
            }
            InstructionValue::Binary(value) => {
                f(&mut value.left);
                f(&mut value.right);
            }
            InstructionValue::Call(value) => {
                f(&mut value.callee);
                for arg in &mut value.arguments {
                    match arg {
                        PlaceOrSpread::Place(item) => f(item),
                        PlaceOrSpread::Spread(item) => f(item),
                    }
                }
            }
            InstructionValue::StoreLocal(value) => {
                f(&mut value.value);
            }
            InstructionValue::Function(value) => {
                for dep in &mut value.dependencies {
                    f(dep)
                }
            }
            InstructionValue::JSXElement(value) => {
                f(&mut value.tag);
                for attr in &mut value.props {
                    match attr {
                        JSXAttribute::Spread { argument } => f(argument),
                        JSXAttribute::Attribute { name: _, value } => f(value),
                    }
                }
                if let Some(children) = &mut value.children {
                    for child in children {
                        f(child)
                    }
                }
            }
            InstructionValue::DeclareContext(_)
            | InstructionValue::LoadContext(_)
            | InstructionValue::LoadGlobal(_)
            | InstructionValue::DeclareLocal(_)
            | InstructionValue::LoadLocal(_)
            | InstructionValue::Primitive(_)
            | InstructionValue::Tombstone => {}
        }
    }
}

#[derive(Debug)]
pub enum InstructionValue {
    Array(Array),
    // Await(Await),
    Binary(Binary),
    Call(Call),
    // ComputedDelete(ComputedDelete),
    // ComputedLoad(ComputedLoad),
    // ComputedStore(ComputedStore),
    // Debugger(Debugger),
    DeclareContext(DeclareContext),
    DeclareLocal(DeclareLocal),
    // Destructure(Destructure),
    Function(FunctionExpression),
    JSXElement(JSXElement),
    // JsxFragment(JsxFragment),
    // JsxText(JsxText),
    LoadContext(LoadContext),
    LoadGlobal(LoadGlobal),
    LoadLocal(LoadLocal),
    // MethodCall(MethodCall),
    // New(New),
    // NextIterable(NextIterable),
    // Object(Object),
    Primitive(Primitive),
    // PropertyDelete(PropertyDelete),
    // PropertyLoad(PropertyLoad),
    // PropertyStore(PropertyStore),
    // RegExp(RegExp),
    // StoreContext(StoreContext),
    StoreLocal(StoreLocal),
    // TaggedTemplate(TaggedTemplate),
    // Template(Template),
    // TypeCast(TypeCast),
    // Unary(Unary),
    Tombstone,
}

#[derive(Debug)]
pub struct Array {
    pub elements: Vec<Option<PlaceOrSpread>>,
}

#[derive(Debug)]
pub enum PlaceOrSpread {
    Place(Operand),
    Spread(Operand),
}

#[derive(Debug)]
pub struct Binary {
    pub left: Operand,
    pub operator: BinaryOperator,
    pub right: Operand,
}

#[derive(Debug)]
pub struct Call {
    pub callee: Operand,
    pub arguments: Vec<PlaceOrSpread>,
}

#[derive(Debug)]
pub struct FunctionExpression {
    pub dependencies: Vec<Operand>,
    pub lowered_function: Box<Function>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Primitive {
    pub value: JsValue,
}

#[derive(Debug)]
pub struct LoadLocal {
    pub place: IdentifierOperand,
}

#[derive(Debug)]
pub struct LoadContext {
    pub place: Operand,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct LoadGlobal {
    pub name: String,
}

#[derive(Debug)]
pub struct DeclareLocal {
    pub lvalue: LValue,
}

#[derive(Debug)]
pub struct DeclareContext {
    pub lvalue: LValue, // note: kind must be InstructionKind::Let
}

#[derive(Debug)]
pub struct StoreLocal {
    pub lvalue: LValue,
    pub value: Operand,
}

#[derive(Debug)]
pub struct JSXElement {
    pub tag: Operand,
    pub props: Vec<JSXAttribute>,
    pub children: Option<Vec<Operand>>,
}

#[derive(Debug)]
pub enum JSXAttribute {
    Spread { argument: Operand },
    Attribute { name: String, value: Operand },
}

#[derive(Clone, Debug)]
pub struct Operand {
    pub ix: InstrIx,
    pub effect: Option<Effect>,
}

#[derive(Clone, Debug)]
pub struct IdentifierOperand {
    pub identifier: Identifier,
    pub effect: Option<Effect>,
}

#[derive(Debug)]
pub struct LValue {
    pub identifier: IdentifierOperand,
    pub kind: InstructionKind,
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub enum InstructionKind {
    /// `const` declaration
    Const,

    /// `let` declaration
    Let,

    /// Reassignment from `=` or assignment-update (`+=` etc)
    Reassign,
}

impl Display for InstructionKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Const => f.write_str("Const"),
            Self::Let => f.write_str("Let"),
            Self::Reassign => f.write_str("Reassign"),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub enum Effect {
    /// This reference freezes the value (corresponds to a place where codegen should emit a freeze instruction)
    Freeze,

    /// This reference reads the value
    Read,

    /// This reference reads and stores the value
    Capture,

    /// This reference *may* write to (mutate) the value. This covers two similar cases:
    /// - The compiler is being conservative and assuming that a value *may* be mutated
    /// - The effect is polymorphic: mutable values may be mutated, non-mutable values
    ///   will not be mutated.
    /// In both cases, we conservatively assume that mutable values will be mutated.
    /// But we do not error if the value is known to be immutable.
    ConditionallyMutate,

    /// This reference *does* write to (mutate) the value. It is an error (invalid input)
    /// if an immutable value flows into a location with this effect.
    Mutate,

    /// This reference may alias to (mutate) the value
    Store,
}

impl Effect {
    pub fn is_mutable(self) -> bool {
        match self {
            Self::Capture | Self::Store | Self::ConditionallyMutate | Self::Mutate => true,
            Self::Read | Self::Freeze => false,
        }
    }
}

impl Display for Effect {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Effect::Capture => "capture",
            Effect::ConditionallyMutate => "mutate?",
            Effect::Freeze => "freeze",
            Effect::Mutate => "mutate",
            Effect::Read => "read",
            Effect::Store => "store",
        })
    }
}

#[derive(Clone, Debug)]
pub struct Identifier {
    /// Uniquely identifiers this identifier
    pub id: IdentifierId,
    pub name: Option<String>,

    pub data: Rc<RefCell<IdentifierData>>,
}

#[derive(Debug)]
pub struct IdentifierData {
    pub mutable_range: MutableRange,

    pub scope: Option<ReactiveScope>,

    pub type_: Type,
}

/// Describes a span of code, generally used to describe the range in which
/// a particular value or set of values is mutable (hence the name).
///
/// Start is inclusive, end is exclusive (ie end is the "first" instruction
/// for which the value is not mutable).
#[derive(Clone, Debug)]
pub struct MutableRange {
    /// start of the range, inclusive.
    pub start: InstructionId,

    /// end of the range, exclusive
    pub end: InstructionId,
}

impl MutableRange {
    pub fn new() -> Self {
        Self {
            start: InstructionId(0),
            end: InstructionId(0),
        }
    }
}

impl Default for MutableRange {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Debug)]
pub struct ReactiveScope {
    pub id: ScopeId,
    pub range: MutableRange,
}
