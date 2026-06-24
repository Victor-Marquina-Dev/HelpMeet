from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Initiative(Base):
    __tablename__ = "initiatives"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meetings: Mapped[list["Meeting"]] = relationship(
        back_populates="initiative", cascade="all, delete-orphan"
    )


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"))
    title: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    initiative: Mapped["Initiative"] = relationship(back_populates="meetings")
    utterances: Mapped[list["Utterance"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    captures: Mapped[list["Capture"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )
    notes: Mapped[list["Note"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan"
    )


class Utterance(Base):
    __tablename__ = "utterances"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    speaker: Mapped[str] = mapped_column(String(10))  # "me" | "others"
    text: Mapped[str] = mapped_column(Text)
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    highlighted: Mapped[bool] = mapped_column(Boolean, default=False)  # ★ Importante
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    meeting: Mapped["Meeting"] = relationship(back_populates="utterances")


class Capture(Base):
    __tablename__ = "captures"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    image_path: Mapped[str] = mapped_column(String(500))
    taken_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    near_utterance_id: Mapped[int | None] = mapped_column(
        ForeignKey("utterances.id"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting: Mapped["Meeting"] = relationship(back_populates="captures")

    @property
    def code(self) -> str:
        """Código corto, único y estable de la captura (p. ej. `CAP-007Y`).

        Deriva del id en base36, así nunca es un simple 1, 2, 3 y no se
        confunde aunque haya muchas imágenes. Sirve de identificador en la
        app y de nombre del archivo al exportar."""
        n = self.id or 0
        digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        s = ""
        while n:
            n, r = divmod(n, 36)
            s = digits[r] + s
        return "CAP-" + (s or "0").rjust(4, "0")


class Note(Base):
    """Nota rápida que el usuario ancla a un momento de la reunión."""
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    meeting: Mapped["Meeting"] = relationship(back_populates="notes")
